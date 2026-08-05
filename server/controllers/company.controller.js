import mongoose from "mongoose";
import Company from "../models/company.model.js";
import Branch from "../models/branch.model.js";
import CompanyMembership from "../models/companyMembership.model.js";
import User from "../models/user.model.js";
import Account from "../models/account.model.js";
import { ERP_MODULES, missingModuleDependencies, normalizeModuleIds, unknownModuleIds } from "../config/erpModules.js";
import { evaluateCompanyAccess, reconcilePermissionGroupsForCompany, upsertMembership } from "../services/tenant.service.js";
import { runWithTenant } from "../config/tenantContext.js";
import { provisionSystemAccounts } from "../services/accountingSetup.service.js";
import { invalidateDashboardCache } from "../utils/cache.js";

const clean = (value) => String(value ?? "").trim();
const escapeRegex = (value) => clean(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const validId = (value) => mongoose.isValidObjectId(value);
const isSuper = (req) => req.user?.role === "superadmin";
const COMPANY_STATUSES = new Set(["active", "trial", "pending", "suspended"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,29}$/;
const FISCAL_START_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const addressPayload = (value = {}) => ({
  line1: clean(value.line1), line2: clean(value.line2), city: clean(value.city), state: clean(value.state),
  postalCode: clean(value.postalCode), country: clean(value.country || "Bangladesh"),
  latitude: clean(value.latitude), longitude: clean(value.longitude),
});

const companyPayload = (body = {}) => ({
  name: clean(body.name), legalName: clean(body.legalName), code: clean(body.code).toUpperCase(),
  industry: clean(body.industry), registrationNo: clean(body.registrationNo), taxId: clean(body.taxId),
  email: clean(body.email).toLowerCase(), phone: clean(body.phone), website: clean(body.website),
  logoUrl: clean(body.logoUrl), address: addressPayload(body.address),
  settings: {
    currency: clean(body.settings?.currency || "BDT").toUpperCase(), timezone: clean(body.settings?.timezone || "Asia/Dhaka"),
    fiscalYearStart: clean(body.settings?.fiscalYearStart || "01-01"), dateFormat: clean(body.settings?.dateFormat || "DD/MM/YYYY"),
  },
  subscription: {
    plan: clean(body.subscription?.plan || "Professional"), startDate: body.subscription?.startDate || new Date(),
    endDate: body.subscription?.endDate || null,
  },
  enabledModules: normalizeModuleIds(body.moduleIds ?? body.enabledModules), status: COMPANY_STATUSES.has(body.status) ? body.status : "active",
  note: clean(body.note),
});

const headOfficePayload = (body = {}, company = {}) => {
  const value = body.headOffice || {};
  return {
    name: clean(value.name || "Main Branch"),
    code: clean(value.code || "MAIN").toUpperCase(),
    email: clean(value.email || company.email).toLowerCase(),
    phone: clean(value.phone || company.phone),
    address: addressPayload(value.address || company.address),
  };
};

const validateCompanySetup = ({ company, headOffice, adminInput, requireAdminPassword = false, requireSubscriptionDates = false }) => {
  if (!company.name || !company.code) return "Company name and code are required.";
  if (!CODE_PATTERN.test(company.code)) return "Company code must be 2-30 characters using letters, numbers, hyphens, or underscores.";
  if (company.email && !EMAIL_PATTERN.test(company.email)) return "Enter a valid company email address.";
  if (!company.address.line1 || !company.address.city || !company.address.country) return "Head-office address, city, and country are required.";
  if (!headOffice.name || !headOffice.code) return "Head-office name and code are required.";
  if (!CODE_PATTERN.test(headOffice.code)) return "Head-office code must be 2-30 characters using letters, numbers, hyphens, or underscores.";
  if (headOffice.email && !EMAIL_PATTERN.test(headOffice.email)) return "Enter a valid head-office email address.";
  if (!FISCAL_START_PATTERN.test(company.settings.fiscalYearStart)) return "Fiscal year start must use MM-DD format.";
  const subscriptionStart = company.subscription.startDate ? new Date(company.subscription.startDate) : null;
  const subscriptionEnd = company.subscription.endDate ? new Date(company.subscription.endDate) : null;
  if (requireSubscriptionDates && (!subscriptionStart || Number.isNaN(subscriptionStart.getTime()))) return "A valid subscription start date is required.";
  if (requireSubscriptionDates && (!subscriptionEnd || Number.isNaN(subscriptionEnd.getTime()))) return "A valid subscription end date is required.";
  if (company.subscription.endDate && company.subscription.startDate && new Date(company.subscription.endDate) < new Date(company.subscription.startDate)) {
    return "Subscription end date cannot be earlier than its start date.";
  }
  if (adminInput) {
    if (!clean(adminInput.name) || !clean(adminInput.email)) return "Tenant Admin name and email are required.";
    if (!EMAIL_PATTERN.test(clean(adminInput.email))) return "Enter a valid tenant Admin email address.";
    if (requireAdminPassword && String(adminInput.password || "").length < 6) return "A temporary Admin password of at least 6 characters is required.";
  }
  return "";
};

const validateRequestedModules = (body = {}) => {
  const requested = body.moduleIds ?? body.enabledModules;
  if (requested !== undefined && !Array.isArray(requested)) return "ERP modules must be provided as an array.";
  const unknown = unknownModuleIds(requested);
  if (unknown.length) return `Unknown ERP module${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`;
  const missing = missingModuleDependencies(requested || []);
  return missing.length
    ? `Missing required module dependencies: ${missing.map(({ moduleId, dependency }) => `${moduleId} requires ${dependency}`).join(", ")}.`
    : "";
};

async function addCompanyMetrics(companies) {
  if (!companies.length) return [];
  const ids = companies.map((item) => item._id);
  // Tenant-scoped queries must use the verified scalar tenant ID. Passing
  // { $in: [...] } for a company Admin is correctly rejected by the tenant
  // guard because request-supplied tenant selectors are not trusted.
  const branchTenantFilter = ids.length === 1 ? ids[0] : { $in: ids };
  const [branchCounts, memberships, mainBranches] = await Promise.all([
    Branch.aggregate([{ $match: { tenantId: { $in: ids }, isActive: { $ne: false } } }, { $group: { _id: "$tenantId", count: { $sum: 1 } } }]),
    CompanyMembership.find({ tenantId: { $in: ids }, role: "admin", isActive: true }).populate("user", "name email phone designation isActive").lean(),
    Branch.find({ tenantId: branchTenantFilter, isMain: true }).lean(),
  ]);
  const counts = new Map(branchCounts.map((item) => [String(item._id), item.count]));
  const admins = new Map(memberships.map((item) => [String(item.tenantId), item.user]));
  const branches = new Map(mainBranches.map((item) => [String(item.tenantId), item]));
  return companies.map((company) => ({
    ...company,
    moduleIds: company.enabledModules || [],
    branchCount: counts.get(String(company._id)) || 0,
    manager: admins.get(String(company._id)) || null,
    headOffice: branches.get(String(company._id))
      ? { ...branches.get(String(company._id)), manager: admins.get(String(company._id)) || null }
      : null,
    subscriptionAccess: evaluateCompanyAccess(company),
  }));
}

export const listModules = (req, res) => {
  const enabled = req.user?.role === "superadmin" ? null : new Set(req.enabledModules || []);
  return res.json({ modules: enabled ? ERP_MODULES.filter((module) => enabled.has(module.id)) : ERP_MODULES });
};

export const listCompanies = async (req, res) => {
  try {
    const filter = isSuper(req) ? {} : { _id: req.tenantId };
    const q = clean(req.query.q);
    if (q && isSuper(req)) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { legalName: rx }, { code: rx }, { email: rx }, { "address.city": rx }];
    }
    if (isSuper(req) && COMPANY_STATUSES.has(req.query.status)) filter.status = req.query.status;
    if (isSuper(req) && clean(req.query.plan)) filter["subscription.plan"] = clean(req.query.plan);
    if (isSuper(req) && clean(req.query.country)) filter["address.country"] = clean(req.query.country);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const [rows, total] = await Promise.all([
      Company.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Company.countDocuments(filter),
    ]);
    const companies = await addCompanyMetrics(rows);
    return res.json({ companies, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load companies.", error: error.message });
  }
};

export const getCompany = async (req, res) => {
  const companyId = isSuper(req) ? req.params.id : req.tenantId;
  if (!validId(companyId)) return res.status(400).json({ message: "Invalid company ID." });
  const company = await Company.findById(companyId).lean();
  if (!company) return res.status(404).json({ message: "Company not found." });
  const [result] = await addCompanyMetrics([company]);
  return res.json({ company: result });
};

export const createCompany = async (req, res) => {
  let company;
  let branch;
  let createdUser = null;
  let assignedExistingUser = null;
  let existingUserSnapshot = null;
  try {
    const moduleError = validateRequestedModules(req.body);
    if (moduleError) return res.status(400).json({ message: moduleError });
    const payload = companyPayload(req.body);
    const headOffice = headOfficePayload(req.body, payload);
    const adminInput = req.body.adminUser || req.body.manager || {};
    const adminName = clean(adminInput.name);
    const adminEmail = clean(adminInput.email).toLowerCase();
    const adminPassword = String(adminInput.password || req.body.adminPassword || "");

    let admin = await User.findOne({ email: adminEmail });
    if (admin?.role === "superadmin") return res.status(400).json({ message: "A Super Admin cannot be assigned as a company admin." });
    if (admin?.tenantId) return res.status(409).json({ message: "This user already belongs to another company." });
    const validationError = validateCompanySetup({
      company: payload,
      headOffice,
      adminInput: { ...adminInput, password: adminPassword },
      requireAdminPassword: !admin,
      requireSubscriptionDates: true,
    });
    if (validationError) return res.status(400).json({ message: validationError });

    company = await Company.create({ ...payload, createdBy: req.user._id, updatedBy: req.user._id });
    branch = await Branch.create({
      tenantId: company._id, ...headOffice, isMain: true, isDefault: true, isActive: true,
      createdBy: req.user._id, updatedBy: req.user._id,
    });

    if (!admin) {
      admin = await User.create({
        name: adminName, email: adminEmail, password: adminPassword, role: "admin",
        tenantId: company._id, defaultBranch: branch._id, isActive: true,
        phone: clean(adminInput.phone), designation: clean(adminInput.designation),
      });
      createdUser = admin;
    } else {
      assignedExistingUser = admin;
      existingUserSnapshot = {
        name: admin.name, phone: admin.phone, designation: admin.designation, role: admin.role,
        tenantId: admin.tenantId, defaultBranch: admin.defaultBranch, isActive: admin.isActive,
      };
      admin.name = adminName;
      admin.phone = clean(adminInput.phone);
      admin.designation = clean(adminInput.designation);
      admin.role = "admin";
      admin.tenantId = company._id;
      admin.defaultBranch = branch._id;
      admin.isActive = true;
      await admin.save({ validateBeforeSave: false });
    }
    await upsertMembership({ user: admin._id, tenantId: company._id, role: "admin", defaultBranch: branch._id, assignedBy: req.user._id });
    await runWithTenant(
      { tenantId: company._id, userId: req.user._id, bypassTenant: false },
      () => provisionSystemAccounts({ userId: req.user._id })
    );
    invalidateDashboardCache();
    const [result] = await addCompanyMetrics([company.toObject()]);
    return res.status(201).json({ message: "Company, tenant admin, and Main Branch created.", company: result, admin: { _id: admin._id, name: admin.name, email: admin.email } });
  } catch (error) {
    if (company?._id) {
      await Promise.allSettled([
        Company.deleteOne({ _id: company._id }), Branch.deleteMany({ tenantId: company._id }),
        CompanyMembership.deleteMany({ tenantId: company._id }), createdUser?._id ? User.deleteOne({ _id: createdUser._id }) : Promise.resolve(),
        Account.deleteMany({ tenantId: company._id }),
      ]);
    }
    if (assignedExistingUser?._id && existingUserSnapshot) {
      const restore = { $set: {} };
      const unset = {};
      for (const [key, value] of Object.entries(existingUserSnapshot)) {
        if (value == null) unset[key] = "";
        else restore.$set[key] = value;
      }
      if (Object.keys(unset).length) restore.$unset = unset;
      await User.collection.updateOne({ _id: assignedExistingUser._id }, restore);
    }
    const status = error?.code === 11000 ? 409 : 500;
    return res.status(status).json({ message: error?.code === 11000 ? "Company code or admin email already exists." : "Failed to create company.", error: error.message });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const moduleError = validateRequestedModules(req.body);
    if (moduleError) return res.status(400).json({ message: moduleError });
    const companyId = isSuper(req) ? req.params.id : req.tenantId;
    if (!validId(companyId)) return res.status(400).json({ message: "Invalid company ID." });
    const incoming = companyPayload(req.body);
    const headOffice = headOfficePayload(req.body, incoming);
    const adminInput = ["admin", "superadmin"].includes(req.user?.role)
      ? req.body.adminUser || req.body.manager || null
      : null;
    const validationError = validateCompanySetup({ company: incoming, headOffice, adminInput, requireSubscriptionDates: isSuper(req) });
    if (validationError) return res.status(400).json({ message: validationError });
    const patch = isSuper(req)
      ? { ...incoming, updatedBy: req.user._id }
      : {
          name: incoming.name, legalName: incoming.legalName, industry: incoming.industry, registrationNo: incoming.registrationNo,
          taxId: incoming.taxId, email: incoming.email, phone: incoming.phone, website: incoming.website, logoUrl: incoming.logoUrl,
          address: incoming.address, settings: incoming.settings, note: incoming.note, updatedBy: req.user._id,
        };
    delete patch.code;
    const company = await Company.findByIdAndUpdate(companyId, { $set: patch }, { new: true, runValidators: true }).lean();
    if (!company) return res.status(404).json({ message: "Company not found." });
    if (isSuper(req)) await reconcilePermissionGroupsForCompany(company._id, company.enabledModules || []);
    let mainBranch = await Branch.findOneAndUpdate(
      { tenantId: companyId, isMain: true },
      { $set: { ...headOffice, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    ).lean();
    if (!mainBranch) {
      mainBranch = await Branch.create({
        tenantId: companyId, ...headOffice, isMain: true, isDefault: true,
        isActive: true, createdBy: req.user._id, updatedBy: req.user._id,
      });
      mainBranch = mainBranch.toObject();
    }
    let manager = null;
    if (adminInput) {
      const membership = await CompanyMembership.findOne({ tenantId: companyId, role: "admin", isActive: true }).lean();
      if (!membership) return res.status(409).json({ message: "This company does not have an active tenant Admin account." });
      manager = await User.findOneAndUpdate(
        { _id: membership.user, tenantId: companyId, role: "admin" },
        { $set: {
          name: clean(adminInput.name), email: clean(adminInput.email).toLowerCase(),
          phone: clean(adminInput.phone), designation: clean(adminInput.designation),
        } },
        { new: true, runValidators: true }
      ).select("name email phone designation isActive").lean();
      if (!manager) return res.status(409).json({ message: "The tenant Admin account could not be updated." });
    }
    invalidateDashboardCache();
    return res.json({
      message: "Company setup updated.",
      company: { ...company, moduleIds: company.enabledModules, manager, headOffice: { ...mainBranch, manager } },
    });
  } catch (error) {
    return res.status(error?.code === 11000 ? 409 : 500).json({ message: "Failed to update company.", error: error.message });
  }
};

export const updateCompanyStatus = async (req, res) => {
  const status = COMPANY_STATUSES.has(req.body.status) ? req.body.status : "";
  if (!status) return res.status(400).json({ message: "Status must be active, trial, pending, or suspended." });
  const company = await Company.findByIdAndUpdate(req.params.id, { $set: { status, updatedBy: req.user._id } }, { new: true }).lean();
  if (!company) return res.status(404).json({ message: "Company not found." });
  invalidateDashboardCache();
  return res.json({ message: `Company ${status}.`, company });
};

const resolveBranchTenant = (req) => isSuper(req) ? req.params.companyId : String(req.tenantId);
const canUseBranchTenant = (req, tenantId) => isSuper(req) || String(req.tenantId) === String(tenantId);

export const listBranches = async (req, res) => {
  const tenantId = resolveBranchTenant(req);
  if (!validId(tenantId) || !canUseBranchTenant(req, tenantId)) return res.status(403).json({ message: "Company access denied." });
  const filter = { tenantId };
  const q = clean(req.query.q);
  if (q) { const rx = new RegExp(escapeRegex(q), "i"); filter.$or = [{ name: rx }, { code: rx }, { "address.city": rx }]; }
  if (req.query.status === "active") filter.isActive = true;
  if (req.query.status === "inactive") filter.isActive = false;
  const branches = await Branch.find(filter).sort({ isDefault: -1, isMain: -1, name: 1 }).lean();
  return res.json({ branches, count: branches.length, readOnly: isSuper(req) });
};

export const createBranch = async (req, res) => {
  try {
    if (isSuper(req)) return res.status(403).json({ message: "Super Admin has read-only branch access." });
    const tenantId = String(req.tenantId);
    const name = clean(req.body.name); const code = clean(req.body.code).toUpperCase();
    if (!name || !code) return res.status(400).json({ message: "Branch name and code are required." });
    const branch = await Branch.create({ tenantId, name, code, email: clean(req.body.email), phone: clean(req.body.phone), address: addressPayload(req.body.address), isActive: req.body.isActive !== false, createdBy: req.user._id });
    return res.status(201).json({ message: "Branch created.", branch });
  } catch (error) {
    return res.status(error?.code === 11000 ? 409 : 500).json({ message: error?.code === 11000 ? "Branch code already exists in this company." : "Failed to create branch.", error: error.message });
  }
};

export const updateBranch = async (req, res) => {
  if (isSuper(req)) return res.status(403).json({ message: "Super Admin has read-only branch access." });
  const patch = { name: clean(req.body.name), code: clean(req.body.code).toUpperCase(), email: clean(req.body.email), phone: clean(req.body.phone), address: addressPayload(req.body.address), updatedBy: req.user._id };
  if (typeof req.body.isActive === "boolean") patch.isActive = req.body.isActive;
  const branch = await Branch.findByIdAndUpdate(req.params.branchId, { $set: patch }, { new: true, runValidators: true });
  if (!branch) return res.status(404).json({ message: "Branch not found." });
  return res.json({ message: "Branch updated.", branch });
};

export const setDefaultBranch = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.branchId);
    if (!branch || branch.isActive === false) return res.status(404).json({ message: "Active branch not found." });
    if (branch.isDefault) return res.json({ message: `${branch.name} is already the default branch.`, branch });
    const previous = await Branch.findOne({ isDefault: true }).select("_id").lean();
    await Branch.updateMany(
      { isDefault: true, _id: { $ne: branch._id } },
      { $set: { isDefault: false, updatedBy: req.user._id } }
    );
    try {
      branch.isDefault = true;
      branch.updatedBy = req.user._id;
      await branch.save();
    } catch (error) {
      if (previous?._id) {
        await Branch.updateOne({ _id: previous._id }, { $set: { isDefault: true, updatedBy: req.user._id } }).catch(() => {});
      }
      throw error;
    }
    const priorIds = [null, previous?._id].filter((value, index) => index === 0 || value);
    await Promise.all([
      User.updateMany({ defaultBranch: { $in: priorIds } }, { $set: { defaultBranch: branch._id } }),
      CompanyMembership.updateMany(
        { tenantId: req.tenantId, defaultBranch: { $in: priorIds } },
        { $set: { defaultBranch: branch._id } }
      ),
    ]);
    return res.json({ message: `${branch.name} is now the default branch.`, branch });
  } catch (error) {
    return res.status(error?.code === 11000 ? 409 : 500).json({
      message: error?.code === 11000 ? "Another branch became the default. Refresh and try again." : "Failed to change the default branch.",
      error: error.message,
    });
  }
};
