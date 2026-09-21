import mongoose from "mongoose";
import CostCenter from "../../models/accounting/costCenter.model.js";
import JournalEntry from "../../models/accounting/journalEntry.model.js";
import {
  resolveTenantId,
  validateCostCenterHierarchy,
  getCostCenterTree,
} from "../../services/accounting/accountingDimension.service.js";

const isId = (val) => mongoose.Types.ObjectId.isValid(String(val || ""));
const clean = (val) => String(val ?? "").trim();
const escapeRegex = (val) => String(val || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listCostCenters = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) {
      return res.status(400).json({ message: "Company / tenant context is required." });
    }

    const isTree = String(req.query.tree || "").toLowerCase() === "true";
    const activeOnly = req.query.active !== undefined && String(req.query.active).toLowerCase() === "true";

    if (isTree) {
      const tree = await getCostCenterTree({ tenantId, activeOnly });
      return res.json({ costCenters: tree });
    }

    const filter = { tenantId };
    if (req.query.active !== undefined && req.query.active !== "all") {
      filter.isActive = String(req.query.active).toLowerCase() === "true";
    }
    if (req.query.isGroup !== undefined && req.query.isGroup !== "all") {
      filter.isGroup = String(req.query.isGroup).toLowerCase() === "true";
    }
    if (req.query.parent && isId(req.query.parent)) {
      filter.parentCostCenter = req.query.parent;
    }
    if (req.query.q && clean(req.query.q)) {
      const rx = new RegExp(escapeRegex(clean(req.query.q)), "i");
      filter.$or = [{ code: rx }, { name: rx }];
    }

    const costCenters = await CostCenter.find(filter)
      .populate("parentCostCenter", "code name isGroup")
      .sort({ code: 1, name: 1 })
      .lean();

    return res.json({ costCenters });
  } catch (error) {
    return res.status(500).json({ message: "Failed to list cost centers.", error: error.message });
  }
};

export const getCostCenter = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid cost center ID." });

    const costCenter = await CostCenter.findOne({ _id: req.params.id, tenantId })
      .populate("parentCostCenter", "code name isGroup")
      .lean();

    if (!costCenter) return res.status(404).json({ message: "Cost center not found." });

    const childrenCount = await CostCenter.countDocuments({ tenantId, parentCostCenter: costCenter._id });
    const hasTransactions = Boolean(await JournalEntry.exists({ tenantId, "lines.costCenter": costCenter._id }));

    return res.json({ costCenter: { ...costCenter, childrenCount, hasTransactions } });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get cost center.", error: error.message });
  }
};

export const createCostCenter = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });

    const code = clean(req.body.code).toUpperCase();
    const name = clean(req.body.name);
    if (!code || !name) {
      return res.status(400).json({ message: "Code and Name are required for a cost center." });
    }

    const parentCostCenter = isId(req.body.parentCostCenter) ? req.body.parentCostCenter : null;
    if (parentCostCenter) {
      await validateCostCenterHierarchy({
        parentCostCenterId: parentCostCenter,
        tenantId,
      });
      // Ensure parent has isGroup = true
      await CostCenter.updateOne({ _id: parentCostCenter, tenantId }, { $set: { isGroup: true } });
    }

    const isGroup = Boolean(req.body.isGroup);
    const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : true;
    const description = clean(req.body.description);

    const costCenter = await CostCenter.create({
      tenantId,
      code,
      name,
      parentCostCenter,
      isGroup,
      isActive,
      description,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    const populated = await CostCenter.findById(costCenter._id)
      .populate("parentCostCenter", "code name isGroup")
      .lean();

    return res.status(201).json({ message: "Cost center created successfully.", costCenter: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "A cost center with this code already exists for your company." });
    }
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return res.status(500).json({ message: "Failed to create cost center.", error: error.message });
  }
};

export const updateCostCenter = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid cost center ID." });

    const existing = await CostCenter.findOne({ _id: req.params.id, tenantId });
    if (!existing) return res.status(404).json({ message: "Cost center not found." });

    const update = {};
    if (req.body.name !== undefined) {
      const name = clean(req.body.name);
      if (!name) return res.status(400).json({ message: "Cost center name cannot be empty." });
      update.name = name;
    }

    if (req.body.code !== undefined) {
      const code = clean(req.body.code).toUpperCase();
      if (!code) return res.status(400).json({ message: "Cost center code cannot be empty." });
      update.code = code;
    }

    if (req.body.description !== undefined) {
      update.description = clean(req.body.description);
    }

    if (req.body.isActive !== undefined) {
      update.isActive = Boolean(req.body.isActive);
    }

    if (req.body.parentCostCenter !== undefined) {
      const parentCostCenter = isId(req.body.parentCostCenter) ? req.body.parentCostCenter : null;
      if (parentCostCenter) {
        await validateCostCenterHierarchy({
          costCenterId: existing._id,
          parentCostCenterId,
          tenantId,
        });
        // Auto-mark new parent as group
        await CostCenter.updateOne({ _id: parentCostCenter, tenantId }, { $set: { isGroup: true } });
      }
      update.parentCostCenter = parentCostCenter;
    }

    if (req.body.isGroup !== undefined) {
      const targetIsGroup = Boolean(req.body.isGroup);
      if (!targetIsGroup && existing.isGroup) {
        const hasChildren = await CostCenter.exists({ tenantId, parentCostCenter: existing._id });
        if (hasChildren) {
          return res.status(400).json({
            message: "Cannot convert a group cost center to a leaf while it contains child cost centers.",
          });
        }
      }
      update.isGroup = targetIsGroup;
    }

    update.updatedBy = req.user?._id || null;

    const updated = await CostCenter.findByIdAndUpdate(
      existing._id,
      { $set: update },
      { new: true, runValidators: true }
    )
      .populate("parentCostCenter", "code name isGroup")
      .lean();

    return res.json({ message: "Cost center updated successfully.", costCenter: updated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "A cost center with this code already exists for your company." });
    }
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return res.status(500).json({ message: "Failed to update cost center.", error: error.message });
  }
};

export const deleteCostCenter = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid cost center ID." });

    const existing = await CostCenter.findOne({ _id: req.params.id, tenantId });
    if (!existing) return res.status(404).json({ message: "Cost center not found." });

    // Guard 1: Children exist
    const hasChildren = await CostCenter.exists({ tenantId, parentCostCenter: existing._id });
    if (hasChildren) {
      return res.status(400).json({
        message: "Cannot delete cost center with child cost centers. Please reassign or delete sub-cost centers first.",
      });
    }

    // Guard 2: Linked journal entries
    const hasTransactions = await JournalEntry.exists({ tenantId, "lines.costCenter": existing._id });
    if (hasTransactions) {
      return res.status(400).json({
        message:
          "Cannot delete cost center because financial transactions have been posted to it. You can deactivate it instead.",
      });
    }

    await CostCenter.findByIdAndDelete(existing._id);
    return res.json({ message: "Cost center deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete cost center.", error: error.message });
  }
};

export default {
  listCostCenters,
  getCostCenter,
  createCostCenter,
  updateCostCenter,
  deleteCostCenter,
};
