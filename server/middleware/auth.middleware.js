import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { ERP_MODULE_IDS, normalizeModuleIds, permissionModule } from "../config/erpModules.js";
import { runWithTenant } from "../config/tenantContext.js";
import { resolveVerifiedTenant } from "../services/tenant.service.js";

const normalizeSystemRole = async (user) => {
  if (["superadmin", "admin", "employee"].includes(user?.role)) return;
  user.role = "employee";
  await user.save({ validateBeforeSave: false });
};

export const protect = async (req, res, next) => {
  try {
    // Module routers may also keep their own protect middleware. When the app
    // mount already authenticated the request, reuse that verified context.
    if (req.user) return next();

    if (
      req.originalUrl === "/api/users/register" ||
      req.originalUrl === "/api/users/login" ||
      req.originalUrl === "/api/users/register-superadmin" ||
      req.originalUrl === "/api/users/superadmin/register" ||
      req.originalUrl === "/api/auth/register-superadmin"
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

    if (req.body && typeof req.body === "object") delete req.body.tenantId;

    if (user.role === "superadmin") {
      req.user = user;
      req.tenantId = null;
      req.enabledModules = null;
      return runWithTenant({ bypassTenant: true, userId: user._id }, () => next());
    }

    const verified = await resolveVerifiedTenant(user);
    if (!verified) {
      return res.status(403).json({ message: "No active company membership was found for this account." });
    }
    if (verified.accessDenied) {
      return res.status(403).json({
        message: verified.subscription.message,
        code: `SUBSCRIPTION_${String(verified.subscription.state || "inactive").toUpperCase()}`,
        subscription: verified.subscription,
      });
    }

    if (req.query?.tenantId) delete req.query.tenantId;
    req.user = user;
    req.membership = verified.membership;
    req.company = verified.company;
    req.tenantId = verified.company._id;
    req.enabledModules = normalizeModuleIds(verified.company.enabledModules);
    req.subscription = verified.subscription;
    return runWithTenant(
      { tenantId: req.tenantId, userId: user._id, bypassTenant: false },
      () => next()
    );
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
  if (req.user?.role !== "admin" || !req.tenantId) {
    return res.status(403).json({ message: "Company Admin access required." });
  }
  next();
};

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
};

export const isCompanyAdminOrSuperAdmin = (req, res, next) => {
  const isPlatformAdmin = req.user?.role === "superadmin";
  const isTenantAdmin = req.user?.role === "admin" && Boolean(req.tenantId);
  if (!isPlatformAdmin && !isTenantAdmin) {
    return res.status(403).json({ message: "Company Admin access required." });
  }
  return next();
};

export const isTenantUser = (req, res, next) => {
  if (req.user?.role === "superadmin" || !req.tenantId) {
    return res.status(403).json({ message: "This operation belongs to a company workspace." });
  }
  return next();
};

export const isEmployee = (req, res, next) => {
  if (req.user?.role !== "employee") {
    return res.status(403).json({ message: "Employee access required." });
  }
  next();
};

export const requirePermission = (permission) => (req, res, next) => {
  if (req.user?.role === "superadmin") {
    const platformPermissions = new Set([
      "dashboard:view", "company:view", "company:manage", "branch:view", "profile:view",
    ]);
    if (platformPermissions.has(permission)) return next();
    return res.status(403).json({ message: "Tenant operational data is not available in the platform Super Admin workspace." });
  }
  const requiredModule = permissionModule(permission);
  if (!requiredModule) {
    return res.status(403).json({ message: "Permission is not assigned to a registered ERP module.", code: "UNREGISTERED_PERMISSION" });
  }
  if (requiredModule !== "administration" && !req.enabledModules?.includes(requiredModule)) {
    return res.status(403).json({ message: `${requiredModule} module is not enabled for this company.`, code: "MODULE_NOT_ENABLED", module: requiredModule });
  }
  if (req.user?.role === "admin") return next();

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
    "bank-setup:view": ["bank-setup:manage", "finance:manage", "payroll:manage"],
    "finance:cost-center:view": ["finance:cost-center:manage", "finance:manage", "finance:view"],
    "finance:cost-center:manage": ["finance:manage"],
    "finance:dimension:view": ["finance:dimension:manage", "finance:manage", "finance:view"],
    "finance:dimension:manage": ["finance:manage"],
  };
  const manageEquivalent = String(permission).endsWith(":view")
    ? String(permission).replace(/:view$/, ":manage")
    : "";
  const moduleActionEquivalent = String(permission).endsWith(":view")
    ? permissions.some((item) => {
        const [itemModule, itemAction] = String(item).split(":");
        return itemModule === String(permission).replace(/:view$/, "") &&
          itemAction &&
          itemAction !== "view";
      })
    : false;
  const allowed =
    permissions.includes(permission) ||
    (compatibility[permission] || []).some((key) => permissions.includes(key)) ||
    (manageEquivalent && permissions.includes(manageEquivalent)) ||
    moduleActionEquivalent;

  if (!allowed) {
    return res.status(403).json({ message: "Permission denied." });
  }

  return next();
};

export const requireModule = (moduleId) => {
  if (!ERP_MODULE_IDS.includes(moduleId)) {
    throw new Error(`Unknown ERP module guard: ${moduleId}`);
  }
  return (req, res, next) => {
    if (req.user?.role === "superadmin") {
      if (moduleId === "administration") return next();
      return res.status(403).json({ message: "Tenant operational data is not available in the platform Super Admin workspace." });
    }
    if (!req.tenantId) return res.status(403).json({ message: "This operation belongs to a company workspace." });
    if (!req.enabledModules?.includes(moduleId)) {
      return res.status(403).json({
        message: `${moduleId} module is not enabled for this company.`,
        code: "MODULE_NOT_ENABLED",
        module: moduleId,
      });
    }
    return next();
  };
};

export const requireAnyPermission = (requiredPermissions = []) => (req, res, next) => {
  if (req.user?.role === "superadmin") {
    const platformPermissions = new Set([
      "dashboard:view", "company:view", "company:manage", "branch:view", "profile:view",
    ]);
    if (requiredPermissions.some((permission) => platformPermissions.has(permission))) return next();
    return res.status(403).json({ message: "Tenant operational data is not available in the platform Super Admin workspace." });
  }
  const companyPermissions = requiredPermissions.filter((permission) => {
    const moduleId = permissionModule(permission);
    return Boolean(moduleId) && (moduleId === "administration" || req.enabledModules?.includes(moduleId));
  });
  if (req.user?.role === "admin" && companyPermissions.length) return next();

  const permissions = req.user?.permissionGroup?.isActive === false
    ? []
    : req.user?.permissionGroup?.permissions || [];
  const allowed = companyPermissions.some((permission) => {
    if (permissions.includes(permission)) return true;
    if (String(permission).endsWith(":view")) {
      return permissions.includes(String(permission).replace(/:view$/, ":manage"));
    }
    return false;
  });

  if (!allowed) return res.status(403).json({ message: "Permission denied." });
  return next();
};
