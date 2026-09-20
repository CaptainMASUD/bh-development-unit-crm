import mongoose from "mongoose";
import PurchaseOrder from "../../models/purchaseOrder.model.js";
import CommercialLC, { LC_STATUSES } from "../../models/commercialLC.model.js";

const clean = (value) => String(value ?? "").trim();
const sessionOptions = (session) => (session ? { session } : {});

const LC_TRANSITIONS = Object.freeze({
  draft: ["application_submitted", "cancelled"],
  application_submitted: ["opened", "cancelled"],
  opened: ["documents_received", "customs_clearance", "goods_received", "settlement_pending", "cancelled"],
  documents_received: ["customs_clearance", "goods_received", "settlement_pending", "cancelled"],
  customs_clearance: ["goods_received", "settlement_pending", "cancelled"],
  goods_received: ["settlement_pending", "settled", "cancelled"],
  settlement_pending: ["settled", "cancelled"],
  settled: ["closed"],
  closed: [],
  cancelled: [],
});

export const assertLCTransition = (from, to) => {
  const source = clean(from).toLowerCase();
  const target = clean(to).toLowerCase();
  if (!LC_STATUSES.includes(target)) {
    throw Object.assign(new Error("Invalid Commercial LC status."), { statusCode: 400 });
  }
  if (source === target) return;
  if (!(LC_TRANSITIONS[source] || []).includes(target)) {
    throw Object.assign(new Error(`Commercial LC cannot move from ${source} to ${target}.`), { statusCode: 409 });
  }
};

export const nextImportDocumentNumber = async ({ prefix, date = new Date(), session = null }) => {
  const year = new Date(date).getUTCFullYear();
  const key = `${prefix}:${year}`;
  const result = await mongoose.connection.collection("documentSequences").findOneAndUpdate(
    { _id: key },
    {
      $inc: { sequence: 1 },
      $setOnInsert: { prefix, year, createdAt: new Date() },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, returnDocument: "after", ...sessionOptions(session) }
  );
  const sequence = result?.sequence ?? result?.value?.sequence;
  if (!Number.isFinite(sequence)) {
    throw Object.assign(new Error(`Failed to allocate ${prefix} document number.`), { statusCode: 500 });
  }
  return `${prefix}-${year}-${String(sequence).padStart(5, "0")}`;
};

export const assertImportPurchaseOrder = async ({ purchaseOrderId, supplierId = null, session = null, requireApproved = true }) => {
  const query = PurchaseOrder.findById(purchaseOrderId);
  if (session) query.session(session);
  const order = await query;
  if (!order) throw Object.assign(new Error("Purchase order not found."), { statusCode: 404 });
  if (order.tradeType !== "import") {
    throw Object.assign(new Error("Commercial LC can only be opened for an import purchase order."), { statusCode: 409 });
  }
  if (requireApproved && !["approved", "partially_received", "received"].includes(order.status)) {
    throw Object.assign(new Error("The import purchase order must be approved before Commercial LC processing."), { statusCode: 409 });
  }
  if (supplierId && String(order.supplier) !== String(supplierId)) {
    throw Object.assign(new Error("Commercial LC supplier must match the purchase-order supplier."), { statusCode: 409 });
  }
  return order;
};

export const updatePurchaseOrderImportStatus = async ({ purchaseOrderId, importStatus, userId = null, session = null }) => {
  const allowed = ["lc_pending", "lc_open", "shipped", "customs_clearance", "goods_received", "settled", "closed"];
  if (!allowed.includes(importStatus)) return null;
  const query = PurchaseOrder.findById(purchaseOrderId);
  if (session) query.session(session);
  const order = await query;
  if (!order || order.tradeType !== "import") return order;
  order.importStatus = importStatus;
  order.updatedBy = userId;
  await order.save(sessionOptions(session));
  return order;
};

export const updateLCStatus = async ({ lc, status, userId = null, session = null }) => {
  assertLCTransition(lc.status, status);
  lc.status = status;
  lc.updatedBy = userId;
  if (status === "application_submitted") {
    lc.submittedAt = new Date();
    lc.submittedBy = userId;
  }
  if (status === "opened") {
    lc.openedDate = lc.openedDate || new Date();
    lc.openedBy = userId;
  }
  if (status === "settled") lc.settledAt = new Date();
  if (status === "closed") {
    lc.closedAt = new Date();
    lc.closedBy = userId;
  }
  if (status === "cancelled") {
    lc.cancelledAt = new Date();
    lc.cancelledBy = userId;
  }
  await lc.save(sessionOptions(session));
  const poStatus = {
    application_submitted: "lc_pending",
    opened: "lc_open",
    documents_received: "lc_open",
    customs_clearance: "customs_clearance",
    goods_received: "goods_received",
    settlement_pending: "goods_received",
    settled: "settled",
    closed: "closed",
  }[status];
  if (poStatus) {
    await updatePurchaseOrderImportStatus({ purchaseOrderId: lc.purchaseOrder, importStatus: poStatus, userId, session });
  }
  return lc;
};

export const findCommercialLCForUpdate = async (id, session = null) => {
  const query = CommercialLC.findById(id);
  if (session) query.session(session);
  const lc = await query;
  if (!lc) throw Object.assign(new Error("Commercial LC not found."), { statusCode: 404 });
  return lc;
};
