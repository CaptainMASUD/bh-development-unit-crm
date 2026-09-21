import mongoose from "mongoose";
import AccountingDimension from "../../models/accounting/accountingDimension.model.js";
import AccountingDimensionValue from "../../models/accounting/accountingDimensionValue.model.js";
import JournalEntry from "../../models/accounting/journalEntry.model.js";
import {
  resolveTenantId,
  ensureSystemDimensions,
} from "../../services/accounting/accountingDimension.service.js";

const isId = (val) => mongoose.Types.ObjectId.isValid(String(val || ""));
const clean = (val) => String(val ?? "").trim();
const escapeRegex = (val) => String(val || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listDimensions = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });

    // Ensure system dimensions exist
    await ensureSystemDimensions({ tenantId });

    const filter = { tenantId };
    if (req.query.active !== undefined && req.query.active !== "all") {
      filter.isActive = String(req.query.active).toLowerCase() === "true";
    }

    const dimensions = await AccountingDimension.find(filter).sort({ isSystem: -1, name: 1 }).lean();

    // Attach values count for custom dimensions
    const dimsWithCounts = await Promise.all(
      dimensions.map(async (dim) => {
        let valuesCount = 0;
        if (["custom_values", "project"].includes(dim.sourceType)) {
          valuesCount = await AccountingDimensionValue.countDocuments({ tenantId, dimension: dim._id });
        }
        return { ...dim, valuesCount };
      })
    );

    return res.json({ dimensions: dimsWithCounts });
  } catch (error) {
    return res.status(500).json({ message: "Failed to list accounting dimensions.", error: error.message });
  }
};

export const getDimension = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid dimension ID." });

    const dimension = await AccountingDimension.findOne({ _id: req.params.id, tenantId }).lean();
    if (!dimension) return res.status(404).json({ message: "Accounting dimension not found." });

    return res.json({ dimension });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get dimension.", error: error.message });
  }
};

export const createDimension = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });

    const name = clean(req.body.name);
    let code = clean(req.body.code).toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!name) return res.status(400).json({ message: "Dimension name is required." });
    if (!code) code = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    const sourceType = clean(req.body.sourceType) || "custom_values";
    const isRequired = Boolean(req.body.isRequired);
    const applicableAccountTypes = Array.isArray(req.body.applicableAccountTypes)
      ? req.body.applicableAccountTypes.filter((t) => ["asset", "liability", "equity", "revenue", "expense"].includes(t))
      : [];
    const description = clean(req.body.description);

    const dimension = await AccountingDimension.create({
      tenantId,
      name,
      code,
      sourceType,
      isSystem: false,
      isActive: true,
      isRequired,
      applicableAccountTypes,
      description,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    return res.status(201).json({ message: "Accounting dimension created successfully.", dimension });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An accounting dimension with this code already exists." });
    }
    return res.status(500).json({ message: "Failed to create accounting dimension.", error: error.message });
  }
};

export const updateDimension = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid dimension ID." });

    const existing = await AccountingDimension.findOne({ _id: req.params.id, tenantId });
    if (!existing) return res.status(404).json({ message: "Accounting dimension not found." });

    const update = {};
    if (req.body.name !== undefined) {
      const name = clean(req.body.name);
      if (!name) return res.status(400).json({ message: "Dimension name cannot be empty." });
      update.name = name;
    }

    if (req.body.description !== undefined) {
      update.description = clean(req.body.description);
    }

    if (req.body.isActive !== undefined) {
      update.isActive = Boolean(req.body.isActive);
    }

    if (req.body.isRequired !== undefined) {
      update.isRequired = Boolean(req.body.isRequired);
    }

    if (req.body.applicableAccountTypes !== undefined) {
      update.applicableAccountTypes = Array.isArray(req.body.applicableAccountTypes)
        ? req.body.applicableAccountTypes.filter((t) =>
            ["asset", "liability", "equity", "revenue", "expense"].includes(t)
          )
        : [];
    }

    // Only allow changing code/sourceType if not a system dimension
    if (!existing.isSystem) {
      if (req.body.code !== undefined) {
        const code = clean(req.body.code).toLowerCase().replace(/[^a-z0-9_]/g, "_");
        if (code) update.code = code;
      }
      if (req.body.sourceType !== undefined) {
        update.sourceType = clean(req.body.sourceType);
      }
    }

    update.updatedBy = req.user?._id || null;

    const updated = await AccountingDimension.findByIdAndUpdate(
      existing._id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    return res.json({ message: "Accounting dimension updated successfully.", dimension: updated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An accounting dimension with this code already exists." });
    }
    return res.status(500).json({ message: "Failed to update accounting dimension.", error: error.message });
  }
};

export const deleteDimension = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid dimension ID." });

    const existing = await AccountingDimension.findOne({ _id: req.params.id, tenantId });
    if (!existing) return res.status(404).json({ message: "Accounting dimension not found." });

    if (existing.isSystem) {
      return res.status(400).json({
        message: "System dimensions cannot be deleted. You can deactivate it instead.",
      });
    }

    await Promise.all([
      AccountingDimension.findByIdAndDelete(existing._id),
      AccountingDimensionValue.deleteMany({ tenantId, dimension: existing._id }),
    ]);

    return res.json({ message: "Accounting dimension deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete dimension.", error: error.message });
  }
};

// --- Dimension Values Management ---

export const listDimensionValues = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });
    if (!isId(req.params.dimensionId)) return res.status(400).json({ message: "Invalid dimension ID." });

    const filter = { tenantId, dimension: req.params.dimensionId };
    if (req.query.active !== undefined && req.query.active !== "all") {
      filter.isActive = String(req.query.active).toLowerCase() === "true";
    }
    if (req.query.q && clean(req.query.q)) {
      const rx = new RegExp(escapeRegex(clean(req.query.q)), "i");
      filter.$or = [{ code: rx }, { name: rx }];
    }

    const values = await AccountingDimensionValue.find(filter).sort({ code: 1, name: 1 }).lean();
    return res.json({ values });
  } catch (error) {
    return res.status(500).json({ message: "Failed to list dimension values.", error: error.message });
  }
};

export const createDimensionValue = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });
    if (!isId(req.params.dimensionId)) return res.status(400).json({ message: "Invalid dimension ID." });

    const dimension = await AccountingDimension.findOne({ _id: req.params.dimensionId, tenantId });
    if (!dimension) return res.status(404).json({ message: "Dimension not found." });

    const code = clean(req.body.code).toUpperCase();
    const name = clean(req.body.name);
    if (!code || !name) return res.status(400).json({ message: "Code and Name are required." });

    const value = await AccountingDimensionValue.create({
      tenantId,
      dimension: dimension._id,
      code,
      name,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      description: clean(req.body.description),
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    return res.status(201).json({ message: "Dimension value created.", value });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "A value with this code already exists for this dimension." });
    }
    return res.status(500).json({ message: "Failed to create dimension value.", error: error.message });
  }
};

export const updateDimensionValue = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });
    if (!isId(req.params.dimensionId) || !isId(req.params.valueId)) {
      return res.status(400).json({ message: "Invalid dimension or value ID." });
    }

    const existing = await AccountingDimensionValue.findOne({
      _id: req.params.valueId,
      dimension: req.params.dimensionId,
      tenantId,
    });
    if (!existing) return res.status(404).json({ message: "Dimension value not found." });

    const update = {};
    if (req.body.code !== undefined) {
      const code = clean(req.body.code).toUpperCase();
      if (!code) return res.status(400).json({ message: "Code cannot be empty." });
      update.code = code;
    }
    if (req.body.name !== undefined) {
      const name = clean(req.body.name);
      if (!name) return res.status(400).json({ message: "Name cannot be empty." });
      update.name = name;
    }
    if (req.body.isActive !== undefined) update.isActive = Boolean(req.body.isActive);
    if (req.body.description !== undefined) update.description = clean(req.body.description);
    update.updatedBy = req.user?._id || null;

    const updated = await AccountingDimensionValue.findByIdAndUpdate(
      existing._id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    return res.json({ message: "Dimension value updated.", value: updated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "A value with this code already exists for this dimension." });
    }
    return res.status(500).json({ message: "Failed to update dimension value.", error: error.message });
  }
};

export const deleteDimensionValue = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user?.companyId || req.tenantId || req.headers?.["x-company-id"]);
    if (!tenantId) return res.status(400).json({ message: "Company / tenant context is required." });
    if (!isId(req.params.dimensionId) || !isId(req.params.valueId)) {
      return res.status(400).json({ message: "Invalid dimension or value ID." });
    }

    const existing = await AccountingDimensionValue.findOne({
      _id: req.params.valueId,
      dimension: req.params.dimensionId,
      tenantId,
    });
    if (!existing) return res.status(404).json({ message: "Dimension value not found." });

    await AccountingDimensionValue.findByIdAndDelete(existing._id);
    return res.json({ message: "Dimension value deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete dimension value.", error: error.message });
  }
};

export default {
  listDimensions,
  getDimension,
  createDimension,
  updateDimension,
  deleteDimension,
  listDimensionValues,
  createDimensionValue,
  updateDimensionValue,
  deleteDimensionValue,
};
