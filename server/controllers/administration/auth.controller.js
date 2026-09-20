import jwt from "jsonwebtoken";
import User from "../../models/user.model.js";
import { resolveVerifiedTenant } from "../../services/tenant.service.js";
import { normalizeModuleIds, permissionsForModules } from "../../config/erpModules.js";
import { PERMISSION_KEYS } from "../../models/permissionGroup.model.js";

const USER_POPULATE = [
  { path: "department", select: "name isActive" },
  { path: "position", select: "title department isActive" },
  { path: "permissionGroup", select: "name permissions isActive" },
];

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIREY || "7d",
  });
};

const normalizeSystemRole = async (user) => {
  if (["superadmin", "admin", "employee"].includes(user?.role)) return;
  user.role = "employee";
  await user.save({ validateBeforeSave: false });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email }).select("+password").populate(USER_POPULATE);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is disabled. Contact admin." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    await normalizeSystemRole(user);

    const verified = user.role === "superadmin" ? null : await resolveVerifiedTenant(user);
    if (user.role !== "superadmin" && !verified) {
      return res.status(403).json({ message: "No active company membership was found for this account." });
    }
    if (verified?.accessDenied) {
      return res.status(403).json({
        message: verified.subscription.message,
        code: `SUBSCRIPTION_${String(verified.subscription.state || "inactive").toUpperCase()}`,
        subscription: verified.subscription,
      });
    }
    const token = signToken(user._id);
    const safeUser = user.toObject();
    delete safeUser.password;
    safeUser.enabledModules = verified ? normalizeModuleIds(verified.company?.enabledModules) : null;
    safeUser.permissionCatalog = verified
      ? permissionsForModules(PERMISSION_KEYS, safeUser.enabledModules)
      : [...PERMISSION_KEYS];
    if (verified && safeUser.permissionGroup) {
      safeUser.permissionGroup.permissions = permissionsForModules(
        safeUser.permissionGroup.permissions,
        safeUser.enabledModules
      );
    }
    safeUser.company = verified?.company || null;
    safeUser.subscription = verified?.subscription || null;

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: safeUser,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in login.",
      error: err.message,
    });
  }
};

export const register = async (req, res) => {
  return res.status(403).json({
    message: "Public registration is disabled. Platform Super Admins create companies, and company Admins create tenant users.",
  });
};

export const registerSuperAdmin = async (req, res) => {
  try {
    const providedKey = String(
      req.body?.key ||
      req.body?.superAdminKey ||
      req.body?.superadminKey ||
      req.headers["x-superadmin-key"] ||
      ""
    ).trim();

    const configuredKey = String(
      process.env.SUPERADMINKEY ||
      process.env.SUPERADMIN_KEY ||
      ""
    ).trim();

    if (!configuredKey) {
      return res.status(500).json({
        message: "SUPERADMINKEY is not configured on the server.",
      });
    }

    if (!providedKey || providedKey !== configuredKey) {
      return res.status(401).json({
        message: "Invalid or unauthorized Super Admin registration key.",
      });
    }

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const phone = String(req.body?.phone || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Full name is required." });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "A valid email address is required." });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "A user with this email already exists." });
    }

    const superadmin = await User.create({
      name,
      email,
      password,
      role: "superadmin",
      isActive: true,
      phone,
      tenantId: null,
    });

    const token = signToken(superadmin._id);
    const safeUser = superadmin.toObject();
    delete safeUser.password;
    safeUser.enabledModules = null;
    safeUser.permissionCatalog = [...PERMISSION_KEYS];
    safeUser.company = null;
    safeUser.subscription = null;

    return res.status(201).json({
      success: true,
      message: "Super admin registered successfully.",
      token,
      user: safeUser,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "A user with this email already exists." });
    }
    return res.status(500).json({
      message: "Server error in super admin registration.",
      error: err.message,
    });
  }
};
