// controllers/invoice.controller.js
import mongoose from "mongoose";
import Invoice from "../models/invoice.model.js";
import Order from "../models/order.model.js";
import Customer from "../models/customer.model.js";

const { Types } = mongoose;

const isAdminOrSuperAdmin = (req) =>
  req.user?.role === "admin" || req.user?.role === "superadmin";

const toObjectIdSafe = (id) => {
  try {
    if (!id) return null;
    if (Types.ObjectId.isValid(id)) return new Types.ObjectId(String(id));
    return null;
  } catch {
    return null;
  }
};

const clampInt = (n, min, max, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(v)));
};

const canAccessCustomer = (customerDoc, user) => {
  if (!customerDoc || !user) return false;
  if (user.role === "admin" || user.role === "superadmin") return true;

  const uid = String(user._id);
  const createdBy = String(customerDoc.createdBy?._id ?? customerDoc.createdBy ?? "");
  const assigned = Array.isArray(customerDoc.assignedTo) ? customerDoc.assignedTo : [];
  const assignedIds = assigned.map((x) => String(x?._id ?? x));
  return createdBy === uid || assignedIds.includes(uid);
};

const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "void"];

/* =========================================================
   CREATE INVOICE (generic)
   POST /invoices
   body: { customerId, orderId, dueAt? }
========================================================= */
export const createInvoice = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.body.customerId);
    const orderId = toObjectIdSafe(req.body.orderId);
    if (!customerId || !orderId) {
      return res.status(400).json({ message: "customerId and orderId are required." });
    }

    const customer = await Customer.findById(customerId).select("_id createdBy assignedTo").lean();
    if (!customer) return res.status(404).json({ message: "Customer not found." });
    if (!canAccessCustomer(customer, req.user)) return res.status(403).json({ message: "No access." });

    const order = await Order.findById(orderId).select("_id customerId totals items").lean();
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (String(order.customerId) !== String(customerId)) {
      return res.status(400).json({ message: "orderId does not belong to customerId." });
    }

    const dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({ message: "Invalid dueAt." });

    const status = req.body.status ? String(req.body.status).toLowerCase() : "sent";
    if (!INVOICE_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid invoice status." });

    const invoice = await Invoice.create({
      customerId,
      orderId,
      status,
      dueAt,
      totals: order.totals,
      paidTotal: 0,
      payments: [],
      createdBy: req.user._id,
    });

    return res.status(201).json({ message: "Invoice created.", invoice });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createInvoice.", error: err.message });
  }
};

/* =========================================================
   ✅ MISSING: CREATE INVOICE FROM ORDER
   POST /invoices/from-order/:orderId
   body: { dueAt?, status? }
========================================================= */
export const createInvoiceFromOrder = async (req, res) => {
  try {
    const orderId = toObjectIdSafe(req.params.orderId);
    if (!orderId) return res.status(400).json({ message: "Invalid orderId." });

    const order = await Order.findById(orderId).select("_id customerId totals items").lean();
    if (!order) return res.status(404).json({ message: "Order not found." });

    const customer = await Customer.findById(order.customerId).select("_id createdBy assignedTo").lean();
    if (!customer) return res.status(404).json({ message: "Customer not found for order." });
    if (!canAccessCustomer(customer, req.user)) return res.status(403).json({ message: "No access." });

    const dueAt = req.body?.dueAt ? new Date(req.body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({ message: "Invalid dueAt." });

    const status = req.body?.status ? String(req.body.status).toLowerCase() : "sent";
    if (!INVOICE_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid invoice status." });

    const invoice = await Invoice.create({
      customerId: order.customerId,
      orderId: order._id,
      status,
      dueAt,
      totals: order.totals,
      paidTotal: 0,
      payments: [],
      createdBy: req.user._id,
    });

    return res.status(201).json({ message: "Invoice created from order.", invoice });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createInvoiceFromOrder.", error: err.message });
  }
};

/* =========================================================
   LIST INVOICES
   GET /invoices?customerId=&status=&limit=&cursor=
========================================================= */
export const getInvoices = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdSafe(req.query.cursor);

    const filter = {};
    const customerId = toObjectIdSafe(req.query.customerId);
    if (customerId) filter.customerId = customerId;

    const status = req.query.status ? String(req.query.status).toLowerCase() : null;
    if (status) filter.status = status;

    if (cursor) filter._id = { $lt: cursor };

    let rows = await Invoice.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("customerId", "name companyName createdBy assignedTo")
      .populate("orderId", "_id status totals")
      .lean();

    if (!isAdminOrSuperAdmin(req)) {
      rows = rows.filter((inv) => canAccessCustomer(inv.customerId, req.user));
    }

    const hasMore = rows.length > limit;
    const invoices = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(invoices[invoices.length - 1]._id) : null;

    return res.status(200).json({ count: invoices.length, hasMore, nextCursor, invoices });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getInvoices.", error: err.message });
  }
};

/* =========================================================
   GET SINGLE INVOICE
   GET /invoices/:id
========================================================= */
export const getInvoiceById = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid invoice id." });

    const invoice = await Invoice.findById(id)
      .populate("customerId", "_id createdBy assignedTo name companyName")
      .populate("orderId", "_id status totals")
      .lean();

    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    if (!canAccessCustomer(invoice.customerId, req.user)) return res.status(403).json({ message: "No access." });

    return res.status(200).json({ invoice });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getInvoiceById.", error: err.message });
  }
};

/* =========================================================
   ADD PAYMENT
   POST /invoices/:id/payments
========================================================= */
export const addInvoicePayment = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid invoice id." });

    const invoice = await Invoice.findById(id).populate("customerId", "_id createdBy assignedTo").lean();
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    if (!canAccessCustomer(invoice.customerId, req.user)) return res.status(403).json({ message: "No access." });

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Invalid amount." });

    const paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();
    if (paidAt && Number.isNaN(paidAt.getTime())) return res.status(400).json({ message: "Invalid paidAt." });

    const payment = {
      _id: new Types.ObjectId(),
      amount,
      method: req.body.method ? String(req.body.method).trim() : "",
      note: req.body.note ? String(req.body.note).trim() : "",
      paidAt,
      createdBy: req.user._id,
    };

    const newPaidTotal = Number(invoice.paidTotal || 0) + amount;
    const invoiceTotal = Number(invoice.totals?.total || 0);

    const newStatus = newPaidTotal >= invoiceTotal && invoiceTotal > 0 ? "paid" : invoice.status;

    await Invoice.updateOne(
      { _id: id },
      {
        $push: { payments: payment },
        $set: { paidTotal: newPaidTotal, status: newStatus },
      }
    );

    const updated = await Invoice.findById(id).lean();
    return res.status(200).json({ message: "Payment added.", invoice: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error in addInvoicePayment.", error: err.message });
  }
};

/* =========================================================
   UPDATE INVOICE (optional but useful)
   PATCH /invoices/:id
   body: { status?, dueAt? }
========================================================= */
export const updateInvoice = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid invoice id." });

    const existing = await Invoice.findById(id).populate("customerId", "_id createdBy assignedTo").lean();
    if (!existing) return res.status(404).json({ message: "Invoice not found." });
    if (!canAccessCustomer(existing.customerId, req.user)) return res.status(403).json({ message: "No access." });

    const $set = {};

    if (req.body.status !== undefined) {
      const status = String(req.body.status ?? "").toLowerCase();
      if (!INVOICE_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid invoice status." });
      $set.status = status;
    }

    if (req.body.dueAt !== undefined) {
      const dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
      if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({ message: "Invalid dueAt." });
      $set.dueAt = dueAt;
    }

    if (Object.keys($set).length === 0) return res.status(200).json({ message: "No changes." });

    await Invoice.updateOne({ _id: id }, { $set });
    const updated = await Invoice.findById(id).lean();

    return res.status(200).json({ message: "Invoice updated.", invoice: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateInvoice.", error: err.message });
  }
};

/* =========================================================
   DELETE INVOICE (admin only)
   DELETE /invoices/:id
========================================================= */
export const deleteInvoice = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin can delete invoices." });
    }

    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid invoice id." });

    const r = await Invoice.deleteOne({ _id: id });
    if (r.deletedCount === 0) return res.status(404).json({ message: "Invoice not found." });

    return res.status(200).json({ message: "Invoice deleted." });
  } catch (err) {
    return res.status(500).json({ message: "Server error in deleteInvoice.", error: err.message });
  }
};
