// ===============================
// middleware/auth.middleware.js
// ===============================
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protect = async (req, res, next) => {
  try {
    // allow auth routes without token
    if (
      req.originalUrl === "/api/users/register" ||
      req.originalUrl === "/api/users/login"
    ) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized. Token missing." });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded.id).populate({
      path: "permissionGroup",
      select: "name permissions isActive",
    });

    if (!user) {
      return res.status(401).json({ message: "Not authorized. User not found." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is disabled." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Not authorized. Invalid or expired token.",
      error: err.message,
    });
  }
};

// ✅ Super Admin only
export const isSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({ message: "Super admin access required." });
  }
  next();
};

// ✅ Admin OR Super Admin (admin-level access)
export const isAdminOrSuperAdmin = (req, res, next) => {
  if (!["admin", "superadmin"].includes(req.user?.role)) {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
};

// ✅ Admin only (strict)
export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
};

// ✅ Employee only
export const isEmployee = (req, res, next) => {
  if (req.user?.role !== "employee") {
    return res.status(403).json({ message: "Employee access required." });
  }
  next();
};

// ✅ Marketing Team only
export const isMarketingTeam = (req, res, next) => {
  if (req.user?.role !== "marketing_team") {
    return res.status(403).json({ message: "Marketing team access required." });
  }
  next();
};

// ✅ Marketing Team OR Admin OR Super Admin
export const isMarketingOrAdmin = (req, res, next) => {
  const permissions = req.user?.permissionGroup?.permissions || [];
  if (
    !["marketing_team", "admin", "superadmin"].includes(req.user?.role) &&
    !(req.user?.role === "employee" && permissions.includes("leads:view"))
  ) {
    return res.status(403).json({
      message: "Lead access required.",
    });
  }
  next();
};

// ✅ Employee OR Marketing Team (staff routes)
export const isEmployeeOrMarketing = (req, res, next) => {
  if (!["employee", "marketing_team"].includes(req.user?.role)) {
    return res.status(403).json({ message: "Staff access required." });
  }
  next();
};

export const requirePermission = (permission) => (req, res, next) => {
  if (["admin", "superadmin"].includes(req.user?.role)) return next();
  if (req.user?.role === "marketing_team" && String(permission).startsWith("leads:")) {
    return next();
  }

  const permissions = req.user?.permissionGroup?.permissions || [];
  if (!permissions.includes(permission)) {
    return res.status(403).json({ message: "Permission denied." });
  }

  return next();
};
