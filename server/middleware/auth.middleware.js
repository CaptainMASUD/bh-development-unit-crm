import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const normalizeSystemRole = async (user) => {
  if (["superadmin", "admin", "employee"].includes(user?.role)) return;
  user.role = "employee";
  await user.save({ validateBeforeSave: false });
};

export const protect = async (req, res, next) => {
  try {
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

    await normalizeSystemRole(user);

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Not authorized. Invalid or expired token.",
      error: err.message,
    });
  }
};

export const isSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({ message: "Super admin access required." });
  }
  next();
};

export const isAdminOrSuperAdmin = (req, res, next) => {
  if (!["admin", "superadmin"].includes(req.user?.role)) {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
};

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
};

export const isEmployee = (req, res, next) => {
  if (req.user?.role !== "employee") {
    return res.status(403).json({ message: "Employee access required." });
  }
  next();
};

export const requirePermission = (permission) => (req, res, next) => {
  if (["admin", "superadmin"].includes(req.user?.role)) return next();

  const permissions = req.user?.permissionGroup?.isActive === false
    ? []
    : req.user?.permissionGroup?.permissions || [];
  const compatibility = {
    "tasks:view": ["customers:view"],
    "tasks:manage": ["customers:manage"],
    "deals:view": ["leads:view"],
    "deals:manage": ["leads:manage"],
    "finance:view": ["finance:manage"],
    "notifications:view": ["dashboard:view"],
    "access-control:view": ["employees:manage", "salary:manage", "payroll:manage", "leaves:manage", "roster:manage"],
    "employees:view": ["employees:manage", "attendance:manage", "payroll:manage", "loans:manage", "leaves:manage", "roster:manage", "salary:manage"],
    "tax.view": ["tax.create", "tax.update", "tax.delete", "tax.assign_employee", "tax.report", "payroll:manage"],
    "expenses:view": ["expenses:manage"],
    "expense-setup:view": ["expense-setup:manage", "expenses:manage"],
  };
  const manageEquivalent = String(permission).endsWith(":view")
    ? String(permission).replace(/:view$/, ":manage")
    : "";
  const allowed =
    permissions.includes(permission) ||
    (compatibility[permission] || []).some((key) => permissions.includes(key)) ||
    (manageEquivalent && permissions.includes(manageEquivalent));

  if (!allowed) {
    return res.status(403).json({ message: "Permission denied." });
  }

  return next();
};
