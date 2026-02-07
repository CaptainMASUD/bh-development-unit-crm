// ===============================
// ✅ controllers/user.controller.js  (FULL UPDATED)
// ✅ Your existing code + Avatar endpoints
// ✅ NEW: Admin/Superadmin must confirm THEIR OWN password before deleting ANY user
//     (employee / marketing_team / admin / superadmin)
//     Body: { password: "YOUR_PASSWORD" }
// ===============================
import User from "../models/user.model.js";
import { uploadCloudinary, deleteCloudinary } from "../utils/cloudinary.js";

/* =========================
   ROLE HELPERS
========================= */
const isSuperAdmin = (req) => req.user?.role === "superadmin";
const isAdminOrSuperAdmin = (req) =>
  ["admin", "superadmin"].includes(req.user?.role);

const denyIfTargetIsSuperAdmin = (targetUser, req, res) => {
  if (targetUser?.role === "superadmin" && !isSuperAdmin(req)) {
    res
      .status(403)
      .json({ message: "Only super admin can manage super admin accounts." });
    return true;
  }
  return false;
};

/* =========================
   ✅ PASSWORD CONFIRMATION (NEW)
   Admin/Superadmin must confirm their own password for deletes.
   Works with: DELETE requests that include JSON body: { password }
========================= */
const requireRequesterPassword = async (req, res) => {
  try {
    const password = String(req.body?.password || "");
    if (!password) {
      res.status(400).json({ message: "Password is required to delete this user." });
      return false;
    }

    const requester = await User.findById(req.user?._id).select("+password");
    if (!requester) {
      res.status(401).json({ message: "Unauthorized." });
      return false;
    }

    const ok = await requester.comparePassword(password);
    if (!ok) {
      res.status(401).json({ message: "Password is incorrect." });
      return false;
    }

    return true;
  } catch (err) {
    res.status(500).json({
      message: "Password verification failed.",
      error: err.message,
    });
    return false;
  }
};

/* =========================
   OPTIMIZATION HELPERS
========================= */
const LIST_PROJECTION =
  "_id name email role isActive avatarUrl createdAt updatedAt";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parseLimit = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
};

const handleMongoDuplicateKey = (err) => {
  if (err?.code === 11000) {
    const key = Object.keys(err.keyPattern || {})[0] || "field";
    return { message: `Duplicate ${key}. This ${key} already exists.` };
  }
  return null;
};

const escapeRegex = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSearchFilter = (qRaw) => {
  const q = String(qRaw || "").trim();
  if (!q) return null;

  const safe = escapeRegex(q);
  const isEmailish = q.includes("@");
  const rx = isEmailish ? new RegExp(safe, "i") : new RegExp(`^${safe}`, "i");

  return { $or: [{ name: rx }, { email: rx }] };
};

// cursor = base64url(JSON.stringify({ ts: createdAtISO, id: _id }))
const encodeCursor = (doc) => {
  if (!doc?._id || !doc?.createdAt) return null;
  const payload = {
    ts: new Date(doc.createdAt).toISOString(),
    id: String(doc._id),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
};

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(String(cursor), "base64url").toString("utf8");
    const obj = JSON.parse(raw);
    if (!obj?.ts || !obj?.id) return null;

    const ts = new Date(obj.ts);
    if (Number.isNaN(ts.getTime())) return null;

    return { ts, id: obj.id };
  } catch {
    return null;
  }
};

const buildCursorFilter = ({ cursorObj, sort }) => {
  if (!cursorObj) return null;

  const { ts, id } = cursorObj;

  // newest: createdAt desc, _id desc
  if (sort === "newest") {
    return {
      $or: [
        { createdAt: { $lt: ts } },
        { createdAt: ts, _id: { $lt: id } },
      ],
    };
  }

  // oldest: createdAt asc, _id asc
  return {
    $or: [
      { createdAt: { $gt: ts } },
      { createdAt: ts, _id: { $gt: id } },
    ],
  };
};

const parseSort = (v) =>
  String(v || "newest") === "oldest" ? "oldest" : "newest";

/**
 * Generic list builder:
 * GET ?q=&active=true|false|all&limit=&cursor=&sort=newest|oldest
 */
const listUsersByRole = async (req, res, role, responseKey) => {
  try {
    const limit = parseLimit(req.query.limit);
    const sort = parseSort(req.query.sort);
    const active = String(req.query.active ?? "all"); // all | true | false
    const cursorObj = decodeCursor(req.query.cursor);

    const filter = { role };

    if (active === "true") filter.isActive = true;
    else if (active === "false") filter.isActive = false;

    const searchFilter = buildSearchFilter(req.query.q);
    if (searchFilter) Object.assign(filter, searchFilter);

    const cursorFilter = buildCursorFilter({ cursorObj, sort });
    if (cursorFilter) Object.assign(filter, cursorFilter);

    const sortSpec =
      sort === "newest"
        ? { createdAt: -1, _id: -1 }
        : { createdAt: 1, _id: 1 };

    const rows = await User.find(filter)
      .select(LIST_PROJECTION)
      .sort(sortSpec)
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;

    return res.status(200).json({
      count: items.length,
      [responseKey]: items,
      hasMore,
      nextCursor,
    });
  } catch (err) {
    return res.status(500).json({
      message: `Server error in list ${role}.`,
      error: err.message,
    });
  }
};

/* =========================
   ✅ AVATAR HELPERS
========================= */
const requireImageFile = (req, res) => {
  if (!req.file?.buffer) {
    res
      .status(400)
      .json({ message: "Avatar image file is required (field: avatar)." });
    return false;
  }
  if (!req.file.mimetype?.startsWith("image/")) {
    res.status(400).json({ message: "Only image files are allowed." });
    return false;
  }
  return true;
};

const uploadAvatarAndReplace = async (userDoc, fileBuffer) => {
  // Upload new first (safer). Then delete old.
  const uploaded = await uploadCloudinary(fileBuffer);
  if (!uploaded?.secure_url || !uploaded?.public_id) return null;

  const oldPublicId = userDoc.avatarPublicId;

  userDoc.avatarUrl = uploaded.secure_url;
  userDoc.avatarPublicId = uploaded.public_id;

  await userDoc.save();

  if (oldPublicId && oldPublicId !== uploaded.public_id) {
    await deleteCloudinary(oldPublicId);
  }

  return uploaded;
};

/* =========================
   ADMIN: EMPLOYEES
========================= */
export const createEmployee = async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    const isActive =
      typeof req.body.isActive === "boolean" ? req.body.isActive : true;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, password are required." });
    }

    const employee = await User.create({
      name,
      email,
      password,
      role: "employee",
      isActive,
    });

    const safe = await User.findById(employee._id)
      .select(LIST_PROJECTION)
      .lean();
    return res.status(201).json({ message: "Employee created.", employee: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in createEmployee.",
      error: err.message,
    });
  }
};

export const getEmployees = async (req, res) => {
  return listUsersByRole(req, res, "employee", "employees");
};

export const getEmployeeById = async (req, res) => {
  try {
    const employee = await User.findOne({
      _id: req.params.id,
      role: "employee",
    })
      .select(LIST_PROJECTION)
      .lean();
    if (!employee) return res.status(404).json({ message: "Employee not found." });

    return res.status(200).json({ employee });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getEmployeeById.",
      error: err.message,
    });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const { name, email, password, isActive } = req.body;

    const wantsPassword = password !== undefined && String(password).length > 0;

    const employee = wantsPassword
      ? await User.findOne({ _id: req.params.id, role: "employee" }).select(
          "+password"
        )
      : await User.findOne({ _id: req.params.id, role: "employee" });

    if (!employee) return res.status(404).json({ message: "Employee not found." });

    if (email !== undefined) {
      const e = String(email ?? "").trim().toLowerCase();
      if (!e) return res.status(400).json({ message: "Email cannot be empty." });
      employee.email = e;
    }

    if (name !== undefined) {
      const n = String(name ?? "").trim();
      if (!n) return res.status(400).json({ message: "Name cannot be empty." });
      employee.name = n;
    }

    if (typeof isActive === "boolean") employee.isActive = isActive;
    if (wantsPassword) employee.password = String(password);

    await employee.save();

    const safe = await User.findById(employee._id)
      .select(LIST_PROJECTION)
      .lean();
    return res.status(200).json({ message: "Employee updated.", employee: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in updateEmployee.",
      error: err.message,
    });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    // ✅ require admin/superadmin password confirmation
    const ok = await requireRequesterPassword(req, res);
    if (!ok) return;

    const employee = await User.findOne({ _id: req.params.id, role: "employee" });
    if (!employee) return res.status(404).json({ message: "Employee not found." });

    if (employee.avatarPublicId) await deleteCloudinary(employee.avatarPublicId);
    await employee.deleteOne();

    return res.status(200).json({ message: "Employee deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteEmployee.",
      error: err.message,
    });
  }
};

/* =========================
   ADMIN: MARKETING TEAM
========================= */
export const createMarketingTeam = async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    const isActive =
      typeof req.body.isActive === "boolean" ? req.body.isActive : true;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, password are required." });
    }

    const marketing = await User.create({
      name,
      email,
      password,
      role: "marketing_team",
      isActive,
    });

    const safe = await User.findById(marketing._id)
      .select(LIST_PROJECTION)
      .lean();
    return res
      .status(201)
      .json({ message: "Marketing team user created.", marketing: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in createMarketingTeam.",
      error: err.message,
    });
  }
};

export const getMarketingTeam = async (req, res) => {
  return listUsersByRole(req, res, "marketing_team", "marketing");
};

export const getMarketingTeamById = async (req, res) => {
  try {
    const marketing = await User.findOne({
      _id: req.params.id,
      role: "marketing_team",
    })
      .select(LIST_PROJECTION)
      .lean();

    if (!marketing) {
      return res
        .status(404)
        .json({ message: "Marketing team user not found." });
    }

    return res.status(200).json({ marketing });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getMarketingTeamById.",
      error: err.message,
    });
  }
};

export const updateMarketingTeam = async (req, res) => {
  try {
    const { name, email, password, isActive } = req.body;

    const wantsPassword = password !== undefined && String(password).length > 0;

    const marketing = wantsPassword
      ? await User.findOne({
          _id: req.params.id,
          role: "marketing_team",
        }).select("+password")
      : await User.findOne({
          _id: req.params.id,
          role: "marketing_team",
        });

    if (!marketing) {
      return res
        .status(404)
        .json({ message: "Marketing team user not found." });
    }

    if (email !== undefined) {
      const e = String(email ?? "").trim().toLowerCase();
      if (!e) return res.status(400).json({ message: "Email cannot be empty." });
      marketing.email = e;
    }

    if (name !== undefined) {
      const n = String(name ?? "").trim();
      if (!n) return res.status(400).json({ message: "Name cannot be empty." });
      marketing.name = n;
    }

    if (typeof isActive === "boolean") marketing.isActive = isActive;
    if (wantsPassword) marketing.password = String(password);

    await marketing.save();

    const safe = await User.findById(marketing._id)
      .select(LIST_PROJECTION)
      .lean();
    return res
      .status(200)
      .json({ message: "Marketing team user updated.", marketing: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in updateMarketingTeam.",
      error: err.message,
    });
  }
};

export const deleteMarketingTeam = async (req, res) => {
  try {
    // ✅ require admin/superadmin password confirmation
    const ok = await requireRequesterPassword(req, res);
    if (!ok) return;

    const marketing = await User.findOne({
      _id: req.params.id,
      role: "marketing_team",
    });
    if (!marketing) {
      return res
        .status(404)
        .json({ message: "Marketing team user not found." });
    }

    if (marketing.avatarPublicId) await deleteCloudinary(marketing.avatarPublicId);
    await marketing.deleteOne();

    return res.status(200).json({ message: "Marketing team user deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteMarketingTeam.",
      error: err.message,
    });
  }
};

/* =========================
   ADMIN: ADMINS
========================= */
export const createAdmin = async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    const isActive =
      typeof req.body.isActive === "boolean" ? req.body.isActive : true;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, password are required." });
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: "admin",
      isActive,
    });

    const safe = await User.findById(admin._id)
      .select(LIST_PROJECTION)
      .lean();
    return res.status(201).json({ message: "Admin created.", admin: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in createAdmin.",
      error: err.message,
    });
  }
};

export const getAdmins = async (req, res) => {
  return listUsersByRole(req, res, "admin", "admins");
};

export const getAdminById = async (req, res) => {
  try {
    const admin = await User.findOne({ _id: req.params.id, role: "admin" })
      .select(LIST_PROJECTION)
      .lean();
    if (!admin) return res.status(404).json({ message: "Admin not found." });

    return res.status(200).json({ admin });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getAdminById.",
      error: err.message,
    });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    const { name, email, password, isActive } = req.body;
    const wantsPassword = password !== undefined && String(password).length > 0;

    const target = wantsPassword
      ? await User.findById(req.params.id).select("+password")
      : await User.findById(req.params.id);

    if (!target) return res.status(404).json({ message: "User not found." });

    if (denyIfTargetIsSuperAdmin(target, req, res)) return;

    if (target.role !== "admin") {
      return res
        .status(400)
        .json({ message: "This endpoint can update only admin accounts." });
    }

    if (email !== undefined) {
      const e = String(email ?? "").trim().toLowerCase();
      if (!e) return res.status(400).json({ message: "Email cannot be empty." });
      target.email = e;
    }

    if (name !== undefined) {
      const n = String(name ?? "").trim();
      if (!n) return res.status(400).json({ message: "Name cannot be empty." });
      target.name = n;
    }

    if (typeof isActive === "boolean") target.isActive = isActive;
    if (wantsPassword) target.password = String(password);

    await target.save();

    const safe = await User.findById(target._id)
      .select(LIST_PROJECTION)
      .lean();
    return res.status(200).json({ message: "Admin updated.", admin: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in updateAdmin.",
      error: err.message,
    });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    // ✅ require password confirmation
    const ok = await requireRequesterPassword(req, res);
    if (!ok) return;

    if (String(req.user?._id) === String(req.params.id)) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });

    if (denyIfTargetIsSuperAdmin(target, req, res)) return;

    if (target.role !== "admin") {
      return res
        .status(400)
        .json({ message: "This endpoint can delete only admin accounts." });
    }

    if (target.avatarPublicId) await deleteCloudinary(target.avatarPublicId);
    await target.deleteOne();

    return res.status(200).json({ message: "Admin deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteAdmin.",
      error: err.message,
    });
  }
};

/* =========================
   SUPERADMIN: SUPERADMINS
========================= */
export const createSuperAdmin = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only super admin can create super admins." });
    }

    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    const isActive =
      typeof req.body.isActive === "boolean" ? req.body.isActive : true;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, password are required." });
    }

    const superadmin = await User.create({
      name,
      email,
      password,
      role: "superadmin",
      isActive,
    });

    const safe = await User.findById(superadmin._id)
      .select(LIST_PROJECTION)
      .lean();
    return res
      .status(201)
      .json({ message: "Super admin created.", superadmin: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in createSuperAdmin.",
      error: err.message,
    });
  }
};

export const getSuperAdmins = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only super admin can view super admins." });
    }
    return listUsersByRole(req, res, "superadmin", "superadmins");
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getSuperAdmins.",
      error: err.message,
    });
  }
};

export const getSuperAdminById = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only super admin can view super admins." });
    }

    const superadmin = await User.findOne({
      _id: req.params.id,
      role: "superadmin",
    })
      .select(LIST_PROJECTION)
      .lean();

    if (!superadmin)
      return res.status(404).json({ message: "Super admin not found." });

    return res.status(200).json({ superadmin });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getSuperAdminById.",
      error: err.message,
    });
  }
};

export const updateSuperAdmin = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only super admin can update super admins." });
    }

    const { name, email, password, isActive } = req.body;
    const wantsPassword = password !== undefined && String(password).length > 0;

    const superadmin = wantsPassword
      ? await User.findOne({
          _id: req.params.id,
          role: "superadmin",
        }).select("+password")
      : await User.findOne({
          _id: req.params.id,
          role: "superadmin",
        });

    if (!superadmin)
      return res.status(404).json({ message: "Super admin not found." });

    if (email !== undefined) {
      const e = String(email ?? "").trim().toLowerCase();
      if (!e) return res.status(400).json({ message: "Email cannot be empty." });
      superadmin.email = e;
    }

    if (name !== undefined) {
      const n = String(name ?? "").trim();
      if (!n) return res.status(400).json({ message: "Name cannot be empty." });
      superadmin.name = n;
    }

    if (typeof isActive === "boolean") superadmin.isActive = isActive;
    if (wantsPassword) superadmin.password = String(password);

    await superadmin.save();

    const safe = await User.findById(superadmin._id)
      .select(LIST_PROJECTION)
      .lean();
    return res
      .status(200)
      .json({ message: "Super admin updated.", superadmin: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in updateSuperAdmin.",
      error: err.message,
    });
  }
};

export const deleteSuperAdmin = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only super admin can delete super admins." });
    }

    // ✅ require password confirmation
    const ok = await requireRequesterPassword(req, res);
    if (!ok) return;

    if (String(req.user?._id) === String(req.params.id)) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own super admin account." });
    }

    const superadmin = await User.findOne({
      _id: req.params.id,
      role: "superadmin",
    });
    if (!superadmin)
      return res.status(404).json({ message: "Super admin not found." });

    if (superadmin.avatarPublicId)
      await deleteCloudinary(superadmin.avatarPublicId);

    await superadmin.deleteOne();
    return res.status(200).json({ message: "Super admin deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteSuperAdmin.",
      error: err.message,
    });
  }
};

/* =========================
   GET ME / UPDATE ME
========================= */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select(LIST_PROJECTION)
      .lean();
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.status(200).json({ user });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getMe.",
      error: err.message,
    });
  }
};

export const updateMe = async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found." });

    if (name !== undefined) {
      const n = String(name).trim();
      if (!n) return res.status(400).json({ message: "Name cannot be empty." });
      user.name = n;
    }

    if (email !== undefined) {
      const e = String(email).trim().toLowerCase();
      if (!e) return res.status(400).json({ message: "Email cannot be empty." });
      user.email = e;
    }

    const wantsPasswordChange =
      newPassword !== undefined && String(newPassword).length > 0;

    if (wantsPasswordChange) {
      if (!currentPassword) {
        return res.status(400).json({
          message: "currentPassword is required to change password.",
        });
      }

      const ok = await user.comparePassword(String(currentPassword));
      if (!ok)
        return res.status(401).json({ message: "Current password is incorrect." });

      if (String(newPassword).length < 6) {
        return res
          .status(400)
          .json({ message: "New password must be at least 6 characters." });
      }

      user.password = String(newPassword);
    }

    await user.save();

    const safe = await User.findById(user._id)
      .select(LIST_PROJECTION)
      .lean();
    return res.status(200).json({ message: "Profile updated.", user: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in updateMe.",
      error: err.message,
    });
  }
};

/* =========================
   ✅ AVATAR ENDPOINTS
========================= */
// PATCH /api/users/me/avatar (form-data: avatar)
export const updateMyAvatar = async (req, res) => {
  try {
    if (!requireImageFile(req, res)) return;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const uploaded = await uploadAvatarAndReplace(user, req.file.buffer);
    if (!uploaded)
      return res.status(500).json({ message: "Failed to upload avatar." });

    const safe = await User.findById(user._id).select(LIST_PROJECTION).lean();
    return res.status(200).json({ message: "Avatar updated.", user: safe });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in updateMyAvatar.",
      error: err.message,
    });
  }
};

// DELETE /api/users/me/avatar
export const deleteMyAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.avatarPublicId) await deleteCloudinary(user.avatarPublicId);

    user.avatarUrl = "";
    user.avatarPublicId = "";
    await user.save();

    const safe = await User.findById(user._id).select(LIST_PROJECTION).lean();
    return res.status(200).json({ message: "Avatar removed.", user: safe });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteMyAvatar.",
      error: err.message,
    });
  }
};

// PATCH /api/users/:id/avatar (admin/superadmin)
export const adminUpdateUserAvatar = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }
    if (!requireImageFile(req, res)) return;

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });

    if (denyIfTargetIsSuperAdmin(target, req, res)) return;

    const uploaded = await uploadAvatarAndReplace(target, req.file.buffer);
    if (!uploaded)
      return res.status(500).json({ message: "Failed to upload avatar." });

    const safe = await User.findById(target._id).select(LIST_PROJECTION).lean();
    return res.status(200).json({ message: "Avatar updated.", user: safe });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in adminUpdateUserAvatar.",
      error: err.message,
    });
  }
};

// DELETE /api/users/:id/avatar (admin/superadmin)
export const adminDeleteUserAvatar = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });

    if (denyIfTargetIsSuperAdmin(target, req, res)) return;

    if (target.avatarPublicId) await deleteCloudinary(target.avatarPublicId);

    target.avatarUrl = "";
    target.avatarPublicId = "";
    await target.save();

    const safe = await User.findById(target._id).select(LIST_PROJECTION).lean();
    return res.status(200).json({ message: "Avatar removed.", user: safe });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in adminDeleteUserAvatar.",
      error: err.message,
    });
  }
};

export const searchMarketingUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const limit = Math.min(Number(req.query.limit || 25), 50);

    const filter = { isActive: true, role: "marketing_team" };

    if (q) {
      filter.nameLower = {
        $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      };
    }

    const users = await User.find(filter)
      .select("name email role")
      .sort({ nameLower: 1, _id: -1 })
      .limit(limit)
      .lean();

    return res.json({ users });
  } catch (e) {
    return res.status(500).json({ message: e.message || "User search failed" });
  }
};
