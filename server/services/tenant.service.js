import mongoose from "mongoose";
import Company from "../models/company.model.js";
import Branch from "../models/branch.model.js";
import CompanyMembership from "../models/companyMembership.model.js";
import User from "../models/user.model.js";
import { LEGACY_ENABLED_MODULE_IDS } from "../config/erpModules.js";

const LEGACY_COMPANY_CODE = "LEGACY";

async function migrateLegacyCollections(tenantId) {
  const excluded = new Set(["companies", "companymemberships"]);
  const operations = Object.entries(mongoose.connection.collections)
    .filter(([name]) => !excluded.has(name))
    .map(async ([name, collection]) => {
      if (name === "users") {
        return collection.updateMany(
          { role: { $ne: "superadmin" }, $or: [{ tenantId: { $exists: false } }, { tenantId: null }] },
          { $set: { tenantId } }
        );
      }
      return collection.updateMany(
        { $or: [{ tenantId: { $exists: false } }, { tenantId: null }] },
        { $set: { tenantId } }
      );
    });
  await Promise.allSettled(operations);
}

async function repairLegacyTenantIndexes() {
  const excluded = new Set(["companies", "companymemberships"]);
  for (const [name, collection] of Object.entries(mongoose.connection.collections)) {
    if (excluded.has(name)) continue;
    const indexes = await collection.indexes().catch(() => []);
    for (const index of indexes) {
      const paths = Object.keys(index.key || {});
      const malformedNestedTenantIndex = paths.some((path) => path !== "tenantId" && path.endsWith(".tenantId"));
      if (malformedNestedTenantIndex) {
        await collection.dropIndex(index.name).catch((error) => {
          if (error?.codeName !== "IndexNotFound") throw error;
        });
        continue;
      }
      if (!index.unique || index.name === "_id_") continue;
      const invalidOptionalTenantIndex = Boolean(index.key?.tenantId && index.sparse === true && !index.partialFilterExpression);
      if (index.key?.tenantId && !invalidOptionalTenantIndex) continue;
      if (name === "users" && paths.length === 1 && paths[0] === "email") continue;
      await collection.dropIndex(index.name).catch((error) => {
        if (error?.codeName !== "IndexNotFound") throw error;
      });
    }
  }
}

const generatedIndexName = (fields = {}) => Object.entries(fields)
  .map(([path, direction]) => `${path}_${direction}`)
  .join("_");

const stableValue = (value) => JSON.stringify(value || null);

const hasIndexSpecificationConflict = (desiredFields = {}, desiredOptions = {}, existing = {}) =>
  stableValue(desiredFields) !== stableValue(existing.key) ||
  Boolean(desiredOptions.unique) !== Boolean(existing.unique) ||
  Boolean(desiredOptions.sparse) !== Boolean(existing.sparse) ||
  stableValue(desiredOptions.partialFilterExpression) !== stableValue(existing.partialFilterExpression) ||
  (desiredOptions.expireAfterSeconds ?? null) !== (existing.expireAfterSeconds ?? null) ||
  stableValue(desiredOptions.collation) !== stableValue(existing.collation);

async function repairIndexSpecificationConflicts() {
  for (const modelName of mongoose.modelNames()) {
    const model = mongoose.model(modelName);
    const existingIndexes = await model.collection.indexes().catch(() => []);
    if (!existingIndexes.length) continue;
    const existingByName = new Map(existingIndexes.map((index) => [index.name, index]));

    for (const [fields, options = {}] of model.schema.indexes()) {
      const name = options.name || generatedIndexName(fields);
      const existing = existingByName.get(name);
      if (!existing || !hasIndexSpecificationConflict(fields, options, existing)) continue;
      await model.collection.dropIndex(name).catch((error) => {
        if (error?.codeName !== "IndexNotFound") throw error;
      });
      existingByName.delete(name);
    }
  }
}

async function repairCompanySubscriptionDates() {
  const companies = await Company.find({
    $or: [
      { "subscription.startDate": { $exists: false } },
      { "subscription.startDate": null },
      { "subscription.endDate": { $exists: false } },
      { "subscription.endDate": null },
    ],
  }).select("subscription createdAt").lean();

  for (const company of companies) {
    const startDate = company.subscription?.startDate || company.createdAt || new Date();
    const endDate = company.subscription?.endDate ? new Date(company.subscription.endDate) : new Date(startDate);
    if (!company.subscription?.endDate) {
      endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
      endDate.setUTCDate(endDate.getUTCDate() - 1);
    }
    await Company.collection.updateOne(
      { _id: company._id },
      { $set: { "subscription.startDate": startDate, "subscription.endDate": endDate } }
    );
  }
}

async function repairLegacyCompanyModules() {
  await Company.collection.updateMany(
    { $or: [{ enabledModules: { $exists: false } }, { enabledModules: null }] },
    { $set: { enabledModules: [...LEGACY_ENABLED_MODULE_IDS] } }
  );
}

export async function ensureLegacyTenant(user) {
  await repairLegacyTenantIndexes();
  let company = await Company.findOne({ code: LEGACY_COMPANY_CODE });
  let created = false;
  if (!company) {
    try {
      company = await Company.create({
        name: "Primary Company",
        legalName: "Primary Company",
        code: LEGACY_COMPANY_CODE,
        enabledModules: [...LEGACY_ENABLED_MODULE_IDS],
        status: "active",
      });
      created = true;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      company = await Company.findOne({ code: LEGACY_COMPANY_CODE });
    }
  }

  let branch = await Branch.findOne({ tenantId: company._id, isDefault: true });
  if (!branch) {
    branch = await Branch.create({
      tenantId: company._id,
      name: "Main Branch",
      code: "MAIN",
      isMain: true,
      isDefault: true,
      isActive: true,
    });
  }

  if (created) await migrateLegacyCollections(company._id);

  await User.collection.updateOne(
    { _id: user._id },
    { $set: { tenantId: company._id, defaultBranch: branch._id } }
  );
  await CompanyMembership.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        tenantId: company._id,
        role: user.role === "admin" ? "admin" : "employee",
        defaultBranch: branch._id,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  user.tenantId = company._id;
  user.defaultBranch = branch._id;
  return { company, branch };
}

export function evaluateCompanyAccess(company, at = new Date()) {
  const now = at instanceof Date ? at : new Date(at);
  const status = String(company?.status || "pending").toLowerCase();
  const startDate = company?.subscription?.startDate ? new Date(company.subscription.startDate) : null;
  const endDate = company?.subscription?.endDate ? new Date(company.subscription.endDate) : null;
  if (endDate && !Number.isNaN(endDate.getTime())) endDate.setUTCHours(23, 59, 59, 999);

  let state = status;
  let message = "Company access is active.";
  let allowed = ["active", "trial"].includes(status);
  if (status === "pending") message = "Company setup is pending activation.";
  if (status === "suspended") message = "Company access is suspended. Contact the platform administrator.";
  if (allowed && startDate && !Number.isNaN(startDate.getTime()) && now < startDate) {
    allowed = false;
    state = "scheduled";
    message = "The company subscription has not started yet.";
  }
  if (allowed && endDate && !Number.isNaN(endDate.getTime()) && now > endDate) {
    allowed = false;
    state = "expired";
    message = "The company subscription has expired. Contact the platform administrator.";
  }

  const millisecondsRemaining = endDate && !Number.isNaN(endDate.getTime()) ? endDate.getTime() - now.getTime() : null;
  return {
    allowed,
    state,
    message,
    startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
    endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
    daysRemaining: millisecondsRemaining == null ? null : Math.max(0, Math.ceil(millisecondsRemaining / 86400000)),
  };
}

export async function resolveVerifiedTenant(user) {
  if (!user || user.role === "superadmin") return null;
  if (!user.tenantId) await ensureLegacyTenant(user);

  let membership = await CompanyMembership.findOne({
    user: user._id,
    tenantId: user.tenantId,
    isActive: true,
  }).lean();
  const company = await Company.findById(user.tenantId).lean();
  if (!company) return null;
  if (!membership && company.code === LEGACY_COMPANY_CODE) {
    membership = await upsertMembership({
      user: user._id,
      tenantId: company._id,
      role: user.role === "admin" ? "admin" : "employee",
      defaultBranch: user.defaultBranch || null,
    });
  }
  if (!membership) return null;
  const subscription = evaluateCompanyAccess(company);
  return { membership, company, subscription, accessDenied: !subscription.allowed };
}

export async function upsertMembership({ user, tenantId, role, defaultBranch, assignedBy }) {
  return CompanyMembership.findOneAndUpdate(
    { user },
    { $set: { tenantId, role, defaultBranch: defaultBranch || null, isActive: true, assignedBy: assignedBy || null } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

export async function initializeTenantArchitecture() {
  await repairLegacyTenantIndexes();
  await repairLegacyCompanyModules();
  await repairCompanySubscriptionDates();
  await repairLegacyCompanyModules();
  const legacyCompany = await Company.findOne({ code: LEGACY_COMPANY_CODE });
  const unassigned = await User.findOne({
    role: { $ne: "superadmin" },
    $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
  });
  if (unassigned) {
    const { company } = await ensureLegacyTenant(unassigned);
    await migrateLegacyCollections(company._id);
  } else if (legacyCompany) {
    await migrateLegacyCollections(legacyCompany._id);
  }
  await repairCompanySubscriptionDates();
  await repairLegacyTenantIndexes();
  await repairIndexSpecificationConflicts();
  const indexResults = await Promise.allSettled(
    mongoose.modelNames().map((modelName) => {
      const model = mongoose.model(modelName);
      return modelName === "Customer" ? model.syncIndexes() : model.createIndexes();
    })
  );
  const failedIndex = indexResults.find((result) => result.status === "rejected");
  if (failedIndex) throw failedIndex.reason;
}
