import mongoose from "mongoose";
import PaymentTerm from "../../models/accounting/paymentTerm.model.js";
import {
  seedDefaultPaymentTerms,
  validatePaymentTermRules,
  generatePaymentSchedule,
} from "../../services/accounting/paymentTerms.service.js";
import { writeAudit, getReqMeta } from "../../utils/audit.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

export const listPaymentTerms = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.company || null;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant company context is required." });
    }

    // Auto-seed standard terms if none exist yet for this tenant
    await seedDefaultPaymentTerms(tenantId);

    const filter = { tenantId };
    if (req.query.active === "true") {
      filter.isActive = true;
    } else if (req.query.active === "false") {
      filter.isActive = false;
    }

    if (req.query.termType && req.query.termType !== "all") {
      filter.termType = clean(req.query.termType);
    }

    if (req.query.applicableTo && req.query.applicableTo !== "all") {
      filter.applicableTo = { $in: ["all", clean(req.query.applicableTo)] };
    }

    const q = clean(req.query.q);
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { code: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    const terms = await PaymentTerm.find(filter)
      .sort({ isSystem: -1, isDefault: -1, name: 1 })
      .lean();

    return res.json({ paymentTerms: terms });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to list payment terms.",
      error: error.message,
    });
  }
};

export const getPaymentTermById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.company || null;
    if (!isId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payment term ID." });
    }

    const term = await PaymentTerm.findOne({ _id: req.params.id, tenantId }).lean();
    if (!term) {
      return res.status(404).json({ message: "Payment term not found." });
    }

    return res.json({ paymentTerm: term });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load payment term.",
      error: error.message,
    });
  }
};

export const createPaymentTerm = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.company || null;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant company context is required." });
    }

    const code = clean(req.body.code).toUpperCase();
    const name = clean(req.body.name);
    const termType = clean(req.body.termType) || "CUSTOM";
    const applicableTo = clean(req.body.applicableTo) || "all";
    const rules = Array.isArray(req.body.rules) ? req.body.rules : [];

    if (!code || !name) {
      return res.status(400).json({ message: "Code and Name are required." });
    }

    const exists = await PaymentTerm.findOne({ tenantId, code });
    if (exists) {
      return res.status(409).json({
        message: `Payment term with code '${code}' already exists for this company.`,
        code: "PAYMENT_TERM_CODE_EXISTS",
      });
    }

    validatePaymentTermRules(rules);

    const term = await PaymentTerm.create({
      tenantId,
      code,
      name,
      description: clean(req.body.description),
      termType,
      applicableTo,
      isSystem: false,
      isActive: req.body.isActive !== false,
      isDefault: Boolean(req.body.isDefault),
      rules,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    await writeAudit({
      actorId: req.user?._id || null,
      action: "create",
      entityType: "PaymentTerm",
      entityId: term._id,
      after: term.toObject(),
      meta: getReqMeta(req),
    });

    return res.status(201).json({
      message: "Payment term created successfully.",
      paymentTerm: term,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to create payment term.",
      error: error.message,
      code: error.code,
    });
  }
};

export const updatePaymentTerm = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.company || null;
    if (!isId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payment term ID." });
    }

    const term = await PaymentTerm.findOne({ _id: req.params.id, tenantId });
    if (!term) {
      return res.status(404).json({ message: "Payment term not found." });
    }

    if (term.isSystem && req.body.rules) {
      return res.status(403).json({
        message: "Rules of system predefined payment terms cannot be modified. Create a custom payment term instead.",
        code: "SYSTEM_PAYMENT_TERM_PROTECTED",
      });
    }

    if (req.body.rules) {
      validatePaymentTermRules(req.body.rules);
      term.rules = req.body.rules;
    }

    if (req.body.name !== undefined) term.name = clean(req.body.name);
    if (req.body.description !== undefined) term.description = clean(req.body.description);
    if (req.body.applicableTo !== undefined) term.applicableTo = clean(req.body.applicableTo);
    if (req.body.isActive !== undefined) term.isActive = Boolean(req.body.isActive);
    if (req.body.isDefault !== undefined) term.isDefault = Boolean(req.body.isDefault);
    term.updatedBy = req.user?._id || null;

    await term.save();

    await writeAudit({
      actorId: req.user?._id || null,
      action: "update",
      entityType: "PaymentTerm",
      entityId: term._id,
      after: term.toObject(),
      meta: getReqMeta(req),
    });

    return res.json({
      message: "Payment term updated successfully.",
      paymentTerm: term,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to update payment term.",
      error: error.message,
      code: error.code,
    });
  }
};

export const togglePaymentTermActive = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.company || null;
    if (!isId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payment term ID." });
    }

    const term = await PaymentTerm.findOne({ _id: req.params.id, tenantId });
    if (!term) {
      return res.status(404).json({ message: "Payment term not found." });
    }

    term.isActive = !term.isActive;
    term.updatedBy = req.user?._id || null;
    await term.save();

    return res.json({
      message: `Payment term ${term.isActive ? "activated" : "deactivated"}.`,
      paymentTerm: term,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to toggle payment term status.",
      error: error.message,
    });
  }
};

export const previewSchedule = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.company || null;
    const { total = 0, paymentTermId = null, customSchedule = null, documentDate = new Date() } = req.body;

    let paymentTerm = null;
    if (paymentTermId && isId(paymentTermId)) {
      paymentTerm = await PaymentTerm.findOne({ _id: paymentTermId, tenantId }).lean();
    }

    const schedule = generatePaymentSchedule({
      documentTotal: Number(total || 0),
      documentDate: documentDate ? new Date(documentDate) : new Date(),
      paymentTerm,
      customSchedule,
    });

    return res.json(schedule);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to preview payment schedule.",
      error: error.message,
      code: error.code,
    });
  }
};
