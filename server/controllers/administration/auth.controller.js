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
