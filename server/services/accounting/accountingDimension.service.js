import mongoose from "mongoose";
import CostCenter from "../../models/accounting/costCenter.model.js";
import AccountingDimension from "../../models/accounting/accountingDimension.model.js";
import AccountingDimensionValue from "../../models/accounting/accountingDimensionValue.model.js";
import Branch from "../../models/branch.model.js";
import Department from "../../models/department.model.js";
import Account from "../../models/accounting/account.model.js";

const isId = (val) => mongoose.Types.ObjectId.isValid(val);
const clean = (val) => String(val || "").trim();

export const resolveTenantId = (input) => {
  if (!input) return null;
  if (isId(input)) return new mongoose.Types.ObjectId(String(input));
  if (typeof input === "object") {
    const candidate = input.tenantId || input.companyId || input._id;
    if (isId(candidate)) return new mongoose.Types.ObjectId(String(candidate));
  }
  return null;
};

/**
 * Ensures baseline system dimensions (cost_center, branch, department, project)
 * exist for the specified tenant. Idempotent.
 */
export const ensureSystemDimensions = async ({ tenantId, session = null }) => {
  const tenant = resolveTenantId(tenantId);
  if (!tenant) return [];

  const defaults = [
    {
      name: "Cost Center",
      code: "cost_center",
      sourceType: "cost_center",
      isSystem: true,
      isRequired: false,
      isActive: true,
      description: "Hierarchical cost center allocation for financial reporting",
    },
    {
      name: "Branch",
      code: "branch",
      sourceType: "branch",
      isSystem: true,
      isRequired: false,
      isActive: true,
      description: "Operating branch dimension",
    },
    {
      name: "Department",
      code: "department",
      sourceType: "department",
      isSystem: true,
      isRequired: false,
      isActive: true,
      description: "Operating department dimension",
    },
    {
      name: "Project",
      code: "project",
      sourceType: "project",
      isSystem: true,
      isRequired: false,
      isActive: true,
      description: "Project-level financial tracking",
    },
  ];

  const existing = await AccountingDimension.find({ tenantId: tenant }).session(session).lean();
  const existingCodes = new Set(existing.map((d) => d.code));

  const missing = defaults.filter((d) => !existingCodes.has(d.code));
  if (missing.length > 0) {
    const toInsert = missing.map((d) => ({ ...d, tenantId: tenant }));
    await AccountingDimension.insertMany(toInsert, session ? { session } : undefined);
  }

  return AccountingDimension.find({ tenantId: tenant }).session(session).lean();
};

/**
 * Validates cost center hierarchy to prevent self-parenting and circular references.
 */
export const validateCostCenterHierarchy = async ({
  costCenterId = null,
  parentCostCenterId = null,
  tenantId,
  session = null,
}) => {
  const tenant = resolveTenantId(tenantId);
  if (!parentCostCenterId) return { valid: true };

  if (costCenterId && String(costCenterId) === String(parentCostCenterId)) {
    throw Object.assign(new Error("A cost center cannot be its own parent."), { statusCode: 400 });
  }

  let parentQuery = CostCenter.findOne({ _id: parentCostCenterId, tenantId: tenant });
  if (session) parentQuery = parentQuery.session(session);
  const parent = await parentQuery;

  if (!parent) {
    throw Object.assign(new Error("Parent cost center not found or belongs to another company."), {
      statusCode: 404,
    });
  }

  // Prevent cycle: traverse up the ancestor chain of the parent.
  // If the costCenterId appears in the ancestor chain, then parent is a descendant of costCenterId!
  if (costCenterId) {
    let currentAncestorId = parent.parentCostCenter;
    const visited = new Set([String(parent._id)]);

    while (currentAncestorId) {
      if (String(currentAncestorId) === String(costCenterId)) {
        throw Object.assign(
          new Error("Cyclic cost center hierarchy detected. A cost center cannot be a child of its descendant."),
          { statusCode: 400 }
        );
      }
      if (visited.has(String(currentAncestorId))) {
        break; // Infinite loop safety
      }
      visited.add(String(currentAncestorId));

      let ancQuery = CostCenter.findById(currentAncestorId).select("parentCostCenter tenantId");
      if (session) ancQuery = ancQuery.session(session);
      const ancestor = await ancQuery;
      if (!ancestor) break;
      currentAncestorId = ancestor.parentCostCenter;
    }
  }

  return { valid: true, parent };
};

/**
 * Builds nested tree representation of cost centers for a tenant.
 */
export const getCostCenterTree = async ({ tenantId, activeOnly = false, session = null }) => {
  const tenant = resolveTenantId(tenantId);
  if (!tenant) return [];

  const filter = { tenantId: tenant };
  if (activeOnly) filter.isActive = true;

  let query = CostCenter.find(filter).sort({ code: 1, name: 1 });
  if (session) query = query.session(session);
  const costCenters = await query.lean();

  const map = new Map();
  costCenters.forEach((cc) => {
    map.set(String(cc._id), { ...cc, children: [], level: 0 });
  });

  const roots = [];
  costCenters.forEach((cc) => {
    const node = map.get(String(cc._id));
    if (cc.parentCostCenter && map.has(String(cc.parentCostCenter))) {
      const parentNode = map.get(String(cc.parentCostCenter));
      node.level = (parentNode.level || 0) + 1;
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

/**
 * Validates dimension constraints on journal lines and enriches lines with normalized dimension data.
 */
export const validatePostingDimensions = async ({ lines = [], tenantId, session = null }) => {
  if (!Array.isArray(lines) || lines.length === 0) return lines;

  const tenant = resolveTenantId(tenantId);
  if (!tenant) return lines;

  // Retrieve active dimensions for tenant
  let dimQuery = AccountingDimension.find({ tenantId: tenant, isActive: true });
  if (session) dimQuery = dimQuery.session(session);
  const activeDimensions = await dimQuery.lean();

  // Load accounts for all lines to inspect account types
  const accountIds = [
    ...new Set(lines.map((l) => (l.account?._id ? l.account._id : l.account)).filter(isId)),
  ];
  let accountQuery = Account.find({ _id: { $in: accountIds } }).select("code name type isGroup isActive");
  if (session) accountQuery = accountQuery.session(session);
  const accounts = await accountQuery.lean();
  const accountMap = new Map(accounts.map((a) => [String(a._id), a]));

  // Collect dimension IDs across lines
  const costCenterIds = new Set();
  const branchIds = new Set();
  const departmentIds = new Set();
  const dimensionValueIds = new Set();

  lines.forEach((line) => {
    const rawDims = line.dimensions instanceof Map ? Object.fromEntries(line.dimensions) : line.dimensions || {};
    const ccId = line.costCenter || rawDims.cost_center;
    const bId = line.branch || rawDims.branch;
    const dId = line.department || rawDims.department;
    const pId = line.project || rawDims.project;

    if (isId(ccId)) costCenterIds.add(String(ccId));
    if (isId(bId)) branchIds.add(String(bId));
    if (isId(dId)) departmentIds.add(String(dId));
    if (isId(pId)) dimensionValueIds.add(String(pId));

    Object.entries(rawDims).forEach(([key, val]) => {
      if (!["cost_center", "branch", "department", "project"].includes(key) && isId(val)) {
        dimensionValueIds.add(String(val));
      }
    });
  });

  // Batch load referenced entities
  const [costCenters, branches, departments, dimensionValues] = await Promise.all([
    costCenterIds.size > 0
      ? CostCenter.find({ _id: { $in: [...costCenterIds] } }).session(session).lean()
      : [],
    branchIds.size > 0
      ? Branch.find({ _id: { $in: [...branchIds] } }).session(session).lean()
      : [],
    departmentIds.size > 0
      ? Department.find({ _id: { $in: [...departmentIds] } }).session(session).lean()
      : [],
    dimensionValueIds.size > 0
      ? AccountingDimensionValue.find({ _id: { $in: [...dimensionValueIds] } }).session(session).lean()
      : [],
  ]);

  const costCenterMap = new Map(costCenters.map((cc) => [String(cc._id), cc]));
  const branchMap = new Map(branches.map((b) => [String(b._id), b]));
  const departmentMap = new Map(departments.map((d) => [String(d._id), d]));
  const dimensionValueMap = new Map(dimensionValues.map((dv) => [String(dv._id), dv]));

  // Validate each line
  const enrichedLines = lines.map((line, index) => {
    const rawAccount = line.account?._id ? line.account._id : line.account;
    const account = accountMap.get(String(rawAccount));

    const rawDims = line.dimensions instanceof Map ? Object.fromEntries(line.dimensions) : line.dimensions || {};
    let lineCostCenter = line.costCenter || rawDims.cost_center || null;
    let lineBranch = line.branch || rawDims.branch || null;
    let lineDepartment = line.department || rawDims.department || null;
    let lineProject = line.project || rawDims.project || null;

    // 1. Cost Center validation
    if (lineCostCenter) {
      const cc = costCenterMap.get(String(lineCostCenter));
      if (!cc || String(cc.tenantId) !== String(tenant)) {
        throw Object.assign(
          new Error(`Line ${index + 1}: Cost center not found or belongs to another company.`),
          { statusCode: 400, code: "COST_CENTER_NOT_FOUND" }
        );
      }
      if (!cc.isActive) {
        throw Object.assign(
          new Error(`Line ${index + 1}: Cost center '${cc.code} - ${cc.name}' is inactive.`),
          { statusCode: 400, code: "COST_CENTER_INACTIVE" }
        );
      }
      if (cc.isGroup) {
        throw Object.assign(
          new Error(
            `Line ${index + 1}: Cannot post directly to group cost center '${cc.code} - ${cc.name}'. Please select a leaf cost center.`
          ),
          { statusCode: 400, code: "COST_CENTER_GROUP_POSTING_NOT_ALLOWED" }
        );
      }
      lineCostCenter = cc._id;
    }

    // 2. Branch validation
    if (lineBranch) {
      const br = branchMap.get(String(lineBranch));
      if (!br || (br.tenantId && String(br.tenantId) !== String(tenant))) {
        throw Object.assign(
          new Error(`Line ${index + 1}: Branch not found or belongs to another company.`),
          { statusCode: 400, code: "BRANCH_NOT_FOUND" }
        );
      }
      if (!br.isActive) {
        throw Object.assign(
          new Error(`Line ${index + 1}: Branch '${br.code || br.name}' is inactive.`),
          { statusCode: 400, code: "BRANCH_INACTIVE" }
        );
      }
      lineBranch = br._id;
    }

    // 3. Department validation
    if (lineDepartment) {
      const dept = departmentMap.get(String(lineDepartment));
      if (!dept || (dept.tenantId && String(dept.tenantId) !== String(tenant))) {
        throw Object.assign(
          new Error(`Line ${index + 1}: Department not found or belongs to another company.`),
          { statusCode: 400, code: "DEPARTMENT_NOT_FOUND" }
        );
      }
      if (!dept.isActive) {
        throw Object.assign(
          new Error(`Line ${index + 1}: Department '${dept.name}' is inactive.`),
          { statusCode: 400, code: "DEPARTMENT_INACTIVE" }
        );
      }
      lineDepartment = dept._id;
    }

    // 4. Project & Custom Dimension Value validation
    if (lineProject && isId(lineProject)) {
      const dv = dimensionValueMap.get(String(lineProject));
      if (dv) {
        if (String(dv.tenantId) !== String(tenant)) {
          throw Object.assign(
            new Error(`Line ${index + 1}: Dimension value belongs to another company.`),
            { statusCode: 400, code: "DIMENSION_VALUE_CROSS_TENANT" }
          );
        }
        if (!dv.isActive) {
          throw Object.assign(
            new Error(`Line ${index + 1}: Project / dimension value '${dv.name}' is inactive.`),
            { statusCode: 400, code: "DIMENSION_VALUE_INACTIVE" }
          );
        }
      }
    }

    // 5. Check Required Dimensions
    if (account) {
      for (const dim of activeDimensions) {
        if (dim.isRequired) {
          const applies =
            !dim.applicableAccountTypes ||
            dim.applicableAccountTypes.length === 0 ||
            dim.applicableAccountTypes.includes(account.type);

          if (applies) {
            let hasValue = false;
            if (dim.code === "cost_center" && lineCostCenter) hasValue = true;
            else if (dim.code === "branch" && lineBranch) hasValue = true;
            else if (dim.code === "department" && lineDepartment) hasValue = true;
            else if (dim.code === "project" && lineProject) hasValue = true;
            else if (rawDims[dim.code]) hasValue = true;

            if (!hasValue) {
              throw Object.assign(
                new Error(
                  `Dimension '${dim.name}' is required for ${account.type} account '${account.code} - ${account.name}' on line ${index + 1}.`
                ),
                { statusCode: 400, code: "ACCOUNTING_DIMENSION_REQUIRED" }
              );
            }
          }
        }
      }
    }

    // Normalize dimensions map
    const normalizedDims = new Map();
    if (lineCostCenter) normalizedDims.set("cost_center", lineCostCenter);
    if (lineBranch) normalizedDims.set("branch", lineBranch);
    if (lineDepartment) normalizedDims.set("department", lineDepartment);
    if (lineProject) normalizedDims.set("project", lineProject);

    Object.entries(rawDims).forEach(([key, val]) => {
      if (!["cost_center", "branch", "department", "project"].includes(key) && val !== undefined && val !== null) {
        normalizedDims.set(key, val);
      }
    });

    return {
      ...line,
      costCenter: lineCostCenter ? new mongoose.Types.ObjectId(String(lineCostCenter)) : null,
      branch: lineBranch ? new mongoose.Types.ObjectId(String(lineBranch)) : null,
      department: lineDepartment ? new mongoose.Types.ObjectId(String(lineDepartment)) : null,
      project: lineProject ? new mongoose.Types.ObjectId(String(lineProject)) : null,
      dimensions: normalizedDims,
    };
  });

  return enrichedLines;
};

export default {
  resolveTenantId,
  ensureSystemDimensions,
  validateCostCenterHierarchy,
  getCostCenterTree,
  validatePostingDimensions,
};
