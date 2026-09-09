import mongoose from "mongoose";
import Invoice from "../../models/invoice.model.js";
import Deal from "../../models/deal.model.js";
import { getReqMeta, writeAudit, writeActivity } from "../../utils/audit.js";
import { nextAccountingNumber } from "../../services/accountingNumbering.service.js";

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
  return res.status(400).json({
    message:
      "Direct invoice creation from deals is deprecated. Please create a Sales Order first via /api/sales/orders/from-deal/:dealId to follow the standard Sales -> Delivery -> Invoice workflow.",
    deprecated: true,
    suggestedEndpoint: `/api/sales/orders/from-deal/${req.params.dealId}`,
  });
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
