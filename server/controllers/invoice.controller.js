import mongoose from "mongoose";
import Invoice from "../models/invoice.model.js";
import Deal from "../models/deal.model.js";
import { getReqMeta, writeAudit, writeActivity } from "../utils/audit.js";
import { nextAccountingNumber } from "../services/accountingNumbering.service.js";

const toObjectId = (value) =>
  value && mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const normalizeString = (value = "") => String(value || "").trim();

const validateDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const invoicePopulate = [
  { path: "customerId", select: "name companyName email phone contactPerson" },
  { path: "dealId", select: "dealNo title stage grandTotal currency" },
  { path: "proposalId", select: "proposalNo title status grandTotal currency" },
  { path: "createdBy", select: "name email role" },
  { path: "payments.receivedBy", select: "name email role" },
];

export const createInvoiceFromDeal = async (req, res) => {
  try {
    const dealId = toObjectId(req.params.dealId);
    if (!dealId) return res.status(400).json({ message: "Invalid deal id" });

    const deal = await Deal.findById(dealId).lean();
    if (!deal) return res.status(404).json({ message: "Deal not found" });

    if (deal.stage !== "won") {
      return res.status(400).json({
        message: "Invoice can only be created after the deal is won.",
      });
    }

    if (!deal.customerId) {
      return res.status(400).json({
        message: "This won deal has no converted customer.",
      });
    }

    const existingInvoice = await Invoice.findOne({
      dealId,
      status: { $ne: "void" },
    })
      .populate(invoicePopulate)
      .lean();

    if (existingInvoice) {
      return res.status(409).json({
        message: "An active invoice already exists for this deal.",
        invoice: existingInvoice,
      });
    }

    const issuedAt = validateDateOrNull(req.body?.issuedAt) || new Date();
    const dueAt = validateDateOrNull(req.body?.dueAt);

    if (req.body?.dueAt && !dueAt) {
      return res.status(400).json({ message: "Invalid invoice due date." });
    }

    if (dueAt && dueAt < issuedAt) {
      return res.status(400).json({
        message: "Invoice due date cannot be before the issue date.",
      });
    }

    const items = Array.isArray(deal.items)
      ? deal.items.map((item) => ({
          productId: item.productId || null,
          nameSnapshot: normalizeString(item.nameSnapshot),
          qty: Math.max(Number(item.qty || 0), 0),
          unitPrice: Math.max(Number(item.unitPrice || 0), 0),
          discount: Math.max(Number(item.discount || 0), 0),
          lineTotal: Math.max(Number(item.lineTotal || 0), 0),
        }))
      : [];

    const invoice = await Invoice.create({
      invoiceNo: await nextAccountingNumber("invoice", issuedAt),
      customerId: deal.customerId,
      dealId: deal._id,
      proposalId: deal.proposalId || null,
      status: "draft",
      currency: deal.currency || "BDT",
      items,
      subtotal: Number(deal.subtotal || 0),
      discountTotal: Number(deal.discountTotal || 0),
      total: Number(deal.grandTotal || 0),
      issuedAt,
      dueAt,
      notes: normalizeString(req.body?.notes),
      createdBy: req.user._id,
    });

    await writeAudit({
      actorId: req.user._id,
      action: "create",
      entityType: "Invoice",
      entityId: invoice._id,
      before: null,
      after: invoice.toObject(),
      meta: getReqMeta(req),
    });

    await writeActivity({
      leadId: deal.leadId,
      customerId: deal.customerId,
      dealId: deal._id,
      proposalId: deal.proposalId,
      invoiceId: invoice._id,
      entityType: "Invoice",
      entityId: invoice._id,
      type: "invoice_created",
      message: `Invoice created: ${invoice.invoiceNo}`,
      createdBy: req.user._id,
      meta: { amount: invoice.total, currency: invoice.currency },
    });

    const populated = await Invoice.findById(invoice._id)
      .populate(invoicePopulate)
      .lean();

    return res.status(201).json({
      message: "Invoice created",
      invoice: populated,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to create invoice",
      error: err.message,
    });
  }
};

export const listInvoices = async (req, res) => {
  try {
    const { dealId, customerId, status, limit = 50 } = req.query || {};
    const filter = {};

    const safeDealId = toObjectId(dealId);
    const safeCustomerId = toObjectId(customerId);
    if (safeDealId) filter.dealId = safeDealId;
    if (safeCustomerId) filter.customerId = safeCustomerId;
    if (status) filter.status = status;

    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const items = await Invoice.find(filter)
      .populate(invoicePopulate)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageSize)
      .lean();

    return res.json({ items });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to list invoices",
      error: err.message,
    });
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid invoice id" });

    const invoice = await Invoice.findById(id).populate(invoicePopulate).lean();
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    return res.json({ invoice });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to get invoice",
      error: err.message,
    });
  }
};

export const addInvoicePayment = async (req, res) => {
  try {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid invoice id" });

    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.status === "void") {
      return res.status(400).json({ message: "Cannot add payment to a void invoice." });
    }

    const amount = Number(req.body?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than zero." });
    }

    const currentPaid = (invoice.payments || []).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
    const currentDue = Math.max(Number(invoice.total || 0) - currentPaid, 0);

    if (amount > currentDue) {
      return res.status(400).json({
        message: `Payment cannot exceed the due amount (${currentDue}).`,
      });
    }

    const method = normalizeString(req.body?.method || "cash").toLowerCase();
    const allowedMethods = ["cash", "bank", "bkash", "nagad", "rocket", "card", "other"];
    if (!allowedMethods.includes(method)) {
      return res.status(400).json({ message: "Invalid payment method." });
    }

    const paidAt = validateDateOrNull(req.body?.paidAt) || new Date();
    const before = invoice.toObject();

    invoice.payments.push({
      amount,
      method,
      transactionId: normalizeString(req.body?.transactionId),
      paidAt,
      note: normalizeString(req.body?.note),
      receivedBy: req.user._id,
    });

    if (invoice.status === "draft") invoice.status = "sent";
    await invoice.save();

    await writeAudit({
      actorId: req.user._id,
      action: "payment_received",
      entityType: "Invoice",
      entityId: invoice._id,
      before,
      after: invoice.toObject(),
      meta: getReqMeta(req),
    });

    await writeActivity({
      customerId: invoice.customerId,
      dealId: invoice.dealId,
      proposalId: invoice.proposalId,
      invoiceId: invoice._id,
      entityType: "Invoice",
      entityId: invoice._id,
      type: invoice.status === "paid" ? "invoice_paid" : "payment_received",
      message: `Payment received for ${invoice.invoiceNo}`,
      createdBy: req.user._id,
      meta: {
        amount,
        method,
        paidTotal: invoice.paidTotal,
        dueTotal: invoice.dueTotal,
      },
    });

    const populated = await Invoice.findById(invoice._id)
      .populate(invoicePopulate)
      .lean();

    return res.json({
      message: "Payment recorded",
      invoice: populated,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to record payment",
      error: err.message,
    });
  }
};
