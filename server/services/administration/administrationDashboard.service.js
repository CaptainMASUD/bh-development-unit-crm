import AuditLog from "../../models/auditLog.model.js";
import Company from "../../models/company.model.js";
import User from "../../models/user.model.js";
import { getSystemSettings } from "./systemSettings.service.js";

const number = (value) => Number(value || 0);
const present = (value) => Boolean(String(value || "").trim());

const task = ({ key, title, type, priority, navigationTarget, description }) => ({
  key,
  title,
  type,
  dueDate: null,
  priority,
  relatedModule: "administration",
  relatedEntity: null,
  responsiblePerson: "Company Administrator",
  status: "open",
  navigationTarget,
  description,
});

export function buildAdministrationDashboard({
  company = {},
  settings = {},
  auditCount = 0,
  activeEmployeeCount = 0,
  inactiveEmployeeCount = 0,
  lockedAccountCount = 0,
} = {}) {
  const checks = [
    ["Company name", present(company.name)],
    ["Company email", present(company.email)],
    ["Company phone", present(company.phone)],
    ["Address", present(company.address?.line1)],
    ["City", present(company.address?.city)],
    ["Country", present(company.address?.country)],
    ["Default currency", present(company.settings?.currency)],
    ["Time zone", present(company.settings?.timezone)],
    ["Fiscal year start", present(company.settings?.fiscalYearStart)],
    ["Company logo", present(company.logo?.url || company.logoUrl)],
  ];
  const missing = checks.filter(([, complete]) => !complete).map(([label]) => label);
  const tasks = [];

  if (!present(company.email) || !present(company.phone)) {
    tasks.push(task({
      key: "company-contact-incomplete",
      title: "Complete company contact information",
      type: "configuration",
      priority: "high",
      navigationTarget: "/admin/administration/company-details",
      description: "Add the company email and phone used across ERP documents.",
    }));
  }
  if (!present(company.logo?.url || company.logoUrl)) {
    tasks.push(task({
      key: "company-logo-missing",
      title: "Upload the company logo",
      type: "configuration",
      priority: "medium",
      navigationTarget: "/admin/administration/company-details",
      description: "The logo is used by shared company and document services.",
    }));
  }
  if (number(auditCount) >= number(settings.auditStorageLimit || 100000)) {
    tasks.push(task({
      key: "audit-storage-limit",
      title: "Review Audit Trail storage",
      type: "audit",
      priority: "high",
      navigationTarget: "/admin/administration/audit-trail",
      description: "The live Audit Trail has reached its configured storage limit.",
    }));
  }
  if (number(lockedAccountCount) > 0) {
    tasks.push(task({
      key: "locked-accounts",
      title: "Review locked employee accounts",
      type: "security",
      priority: "high",
      navigationTarget: "/admin/administration/employee-account-control",
      description: `${number(lockedAccountCount)} employee account${number(lockedAccountCount) === 1 ? " is" : "s are"} locked.`,
    }));
  }

  return {
    summary: {
      companyStatus: company.status || "active",
      activeEmployees: number(activeEmployeeCount),
      inactiveEmployees: number(inactiveEmployeeCount),
      lockedAccounts: number(lockedAccountCount),
      auditRecords: number(auditCount),
    },
    tasks,
    completeness: {
      percent: Math.round(((checks.length - missing.length) / checks.length) * 100),
      missing,
    },
  };
}

export async function getAdministrationDashboard({ tenantId }) {
  if (!tenantId) {
    throw Object.assign(new Error("A verified tenant is required."), { statusCode: 403 });
  }

  const [company, settings, auditCount, activeEmployeeCount, inactiveEmployeeCount, lockedAccountCount] = await Promise.all([
    Company.findById(tenantId).lean(),
    getSystemSettings({ tenantId }),
    AuditLog.countDocuments({ tenantId }),
    User.countDocuments({ tenantId, role: { $ne: "superadmin" }, isActive: true }),
    User.countDocuments({ tenantId, role: { $ne: "superadmin" }, isActive: false }),
    User.countDocuments({ tenantId, role: { $ne: "superadmin" }, accountLocked: true }),
  ]);

  if (!company) {
    throw Object.assign(new Error("Company not found."), { statusCode: 404 });
  }

  return buildAdministrationDashboard({
    company,
    settings,
    auditCount,
    activeEmployeeCount,
    inactiveEmployeeCount,
    lockedAccountCount,
  });
}
