import { SalesReturn } from "../../models/sales/salesReturn.model.js";
import { SalesInvoice } from "../../models/sales/salesInvoice.model.js";
import { SalesOrder } from "../../models/sales/salesOrder.model.js";
import { nextSalesNumber } from "../../services/salesNumber.service.js";
import { postSalesReturnToAccounting, receiveSalesReturn } from "../../services/salesIntegration.service.js";
import { postCustomerRefund } from "../../services/salesIntegration.service.js";
import { SalesError, assertTenant } from "../../utils/salesError.js";
import { getReqMeta, writeAudit } from "../../utils/audit.js";

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const quantity = (value) => Math.round(Number(value || 0) * 1000000) / 1000000;

export const createSalesReturn = async (req, res) => {
  const tenantId = assertTenant(req);
  const invoice = await SalesInvoice.findOne({ _id: req.body.salesInvoiceId, status: { $in: ["posted", "sent", "partially_paid", "paid", "overdue"] } });
  if (!invoice) throw new SalesError("A posted sales invoice is required for a return.", 404);
  const order = await SalesOrder.findById(invoice.salesOrderId);
  if (!order) throw new SalesError("The source sales order was not found.", 404);
  const requested = Array.isArray(req.body.lines) ? req.body.lines : [];
  if (!requested.length) throw new SalesError("At least one return line is required.", 400);
  const previous = await SalesReturn.find({ salesInvoiceId: invoice._id, status: { $in: ["draft", "pending_approval", "posted"] } }).select("lines").lean();
  const alreadyReturned = new Map();
  for (const item of previous) for (const line of item.lines || []) alreadyReturned.set(String(line.invoiceLineId), quantity((alreadyReturned.get(String(line.invoiceLineId)) || 0) + line.quantity));
  const invoiceLines = new Map(invoice.lines.map((line) => [String(line._id), line]));
  const lines = requested.map((item, index) => {
    const source = invoiceLines.get(String(item.invoiceLineId));
    if (!source) throw new SalesError(`Line ${index + 1}: invoice line was not found.`, 400);
    const returnQty = quantity(item.quantity);
    const available = quantity(source.quantity - (alreadyReturned.get(String(source._id)) || 0));
    if (returnQty <= 0 || returnQty > available) throw new SalesError(`Line ${index + 1}: return quantity must be between 0 and ${available}.`, 409);
    if (!String(item.reason || req.body.reason || "").trim()) throw new SalesError(`Line ${index + 1}: return reason is required.`, 400);
    const ratio = returnQty / Number(source.quantity || 1);
    const netAmount = money((Number(source.lineSubtotal || 0) - Number(source.lineDiscount || 0)) * ratio);
    const taxAmount = money(Number(source.lineTax || 0) * ratio);
    return {
      orderLineId: source.orderLineId,
      invoiceLineId: source._id,
      productId: source.productId,
      quantity: returnQty,
      unitPrice: source.unitPrice,
      netAmount,
      taxAmount,
      totalAmount: money(netAmount + taxAmount),
      unitCost: money(source.unitCost || 0),
      condition: item.condition || "resalable",
      restock: item.restock !== false && (item.condition || "resalable") === "resalable",
      reason: item.reason || req.body.reason,
    };
  });
  const totals = lines.reduce((result, line) => ({
    netAmount: money(result.netAmount + line.netAmount),
    taxAmount: money(result.taxAmount + line.taxAmount),
    totalAmount: money(result.totalAmount + line.totalAmount),
    inventoryValue: money(result.inventoryValue + (line.restock ? line.quantity * line.unitCost : 0)),
  }), { netAmount: 0, taxAmount: 0, totalAmount: 0, inventoryValue: 0 });
  const salesReturn = await SalesReturn.create({
    tenantId,
    branchId: invoice.branchId,
    returnNumber: await nextSalesNumber({ tenantId, documentType: "return" }),
    salesOrderId: order._id,
    salesInvoiceId: invoice._id,
    customerId: invoice.customerId,
    warehouseId: req.body.warehouseId || order.warehouseId,
    returnDate: req.body.returnDate || new Date(),
    currency: invoice.currency,
    lines,
    ...totals,
    reason: req.body.reason,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  await writeAudit({ actorId: req.user._id, action: "create", entityType: "SalesReturn", entityId: salesReturn._id, after: salesReturn.toObject(), meta: getReqMeta(req) });
  return res.status(201).json({ success: true, data: salesReturn });
};

export const listSalesReturns = async (req, res) => {
  assertTenant(req);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const filter = {};
  for (const field of ["status", "customerId", "salesInvoiceId", "salesOrderId"]) if (req.query[field]) filter[field] = req.query[field];
  const [items, total] = await Promise.all([
    SalesReturn.find(filter).populate("customerId", "name companyName").sort({ returnDate: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SalesReturn.countDocuments(filter),
  ]);
  return res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

export const getSalesReturn = async (req, res) => {
  assertTenant(req);
  const item = await SalesReturn.findById(req.params.id)
    .populate("customerId", "name companyName email phone")
    .populate("salesInvoiceId", "invoiceNumber status totals paidAmount dueAmount")
    .populate("salesOrderId", "orderNumber status");
  if (!item) throw new SalesError("Sales return was not found.", 404);
  return res.json({ success: true, data: item });
};

export const submitSalesReturn = async (req, res) => {
  assertTenant(req);
  const item = await SalesReturn.findById(req.params.id);
  if (!item) throw new SalesError("Sales return was not found.", 404);
  if (item.status !== "draft") throw new SalesError("Only a draft return can be submitted.", 409);
  item.status = "pending_approval";
  item.submittedAt = new Date();
  item.submittedBy = req.user._id;
  item.updatedBy = req.user._id;
  await item.save();
  await writeAudit({ actorId: req.user._id, action: "submit", entityType: "SalesReturn", entityId: item._id, after: item.toObject(), meta: getReqMeta(req) });
  return res.json({ success: true, data: item });
};

export const approveSalesReturn = async (req, res) => {
  assertTenant(req);
  const item = await SalesReturn.findById(req.params.id);
  if (!item) throw new SalesError("Sales return was not found.", 404);
  if (item.status === "posted") return res.json({ success: true, data: item, idempotentReplay: true });
  if (item.status !== "pending_approval") throw new SalesError("Only a submitted return can be approved.", 409);
  const inventory = await receiveSalesReturn(req, {
    returnId: item._id, returnNumber: item.returnNumber, warehouseId: item.warehouseId,
    lines: item.lines, reason: item.reason, performedBy: req.user._id,
  });
  const accounting = await postSalesReturnToAccounting(req, {
    returnId: item._id, returnNumber: item.returnNumber, returnDate: item.returnDate,
    customerId: item.customerId, currency: item.currency, netAmount: item.netAmount,
    taxAmount: item.taxAmount, totalAmount: item.totalAmount,
    inventoryValue: inventory.totalValue || item.inventoryValue, performedBy: req.user._id,
  });
  const [invoice, order] = await Promise.all([
    SalesInvoice.findById(item.salesInvoiceId), SalesOrder.findById(item.salesOrderId),
  ]);
  if (!invoice || !order) throw new SalesError("The source invoice or order no longer exists.", 409);
  const priorDue = Number(invoice.dueAmount || 0);
  const returnRefundDue = money(Math.max(item.totalAmount - priorDue, 0));
  invoice.creditedAmount = money(Number(invoice.creditedAmount || 0) + item.totalAmount);
  invoice.dueAmount = money(Math.max(priorDue - item.totalAmount, 0));
  invoice.refundDue = money(Number(invoice.refundDue || 0) + returnRefundDue);
  if (invoice.dueAmount === 0 && invoice.refundDue === 0) invoice.status = "paid";
  const orderMap = new Map(order.lines.map((line) => [String(line._id), line]));
  for (const line of item.lines) {
    const orderLine = orderMap.get(String(line.orderLineId));
    if (orderLine) orderLine.returnedQty = quantity(Number(orderLine.returnedQty || 0) + line.quantity);
  }
  item.status = "posted";
  item.inventoryMovement = inventory.stockMovementId;
  item.creditJournal = accounting.journalEntryId;
  item.refundDue = returnRefundDue;
  item.postedAt = new Date();
  item.postedBy = req.user._id;
  item.updatedBy = req.user._id;
  await Promise.all([invoice.save(), order.save(), item.save()]);
  await writeAudit({ actorId: req.user._id, action: "approve", entityType: "SalesReturn", entityId: item._id, after: item.toObject(), meta: getReqMeta(req) });
  return res.json({ success: true, data: item, inventory, accounting });
};

export const rejectSalesReturn = async (req, res) => {
  assertTenant(req);
  const item = await SalesReturn.findById(req.params.id);
  if (!item) throw new SalesError("Sales return was not found.", 404);
  if (item.status !== "pending_approval") throw new SalesError("Only a submitted return can be rejected.", 409);
  if (!String(req.body.reason || "").trim()) throw new SalesError("Rejection reason is required.", 400);
  item.status = "rejected";
  item.rejectedAt = new Date();
  item.rejectedBy = req.user._id;
  item.rejectionReason = req.body.reason;
  item.updatedBy = req.user._id;
  await item.save();
  await writeAudit({ actorId: req.user._id, action: "reject", entityType: "SalesReturn", entityId: item._id, after: item.toObject(), meta: getReqMeta(req) });
  return res.json({ success: true, data: item });
};

export const cancelSalesReturn = async (req, res) => {
  assertTenant(req);
  const item = await SalesReturn.findById(req.params.id);
  if (!item) throw new SalesError("Sales return was not found.", 404);
  if (!["draft", "pending_approval"].includes(item.status)) throw new SalesError("Only an unposted return can be cancelled.", 409);
  if (!String(req.body.reason || "").trim()) throw new SalesError("Cancellation reason is required.", 400);
  item.status = "cancelled";
  item.rejectionReason = req.body.reason;
  item.updatedBy = req.user._id;
  await item.save();
  await writeAudit({ actorId: req.user._id, action: "cancel", entityType: "SalesReturn", entityId: item._id, after: item.toObject(), meta: { ...getReqMeta(req), reason: req.body.reason } });
  return res.json({ success: true, data: item });
};

export const refundSalesReturn = async (req, res) => {
  assertTenant(req);
  const item = await SalesReturn.findById(req.params.id);
  if (!item) throw new SalesError("Sales return was not found.", 404);
  if (item.status !== "posted") throw new SalesError("Only a posted sales return can be refunded.", 409);
  if (Number(item.refundedAmount || 0) > 0) return res.json({ success: true, data: item, idempotentReplay: true });
  const outstandingRefund = money(Number(item.refundDue || 0) - Number(item.refundedAmount || 0));
  const amount = money(req.body.amount || outstandingRefund);
  if (amount <= 0 || amount !== outstandingRefund) throw new SalesError("Refund the exact outstanding customer-credit amount for this return.", 400);
  const refundId = item._id;
  const posting = await postCustomerRefund(req, {
    refundId, returnNumber: item.returnNumber, customerId: item.customerId, currency: item.currency,
    amount, refundDate: req.body.refundDate || new Date(), reference: req.body.reference,
    treasuryAccount: req.body.treasuryAccount, treasuryType: req.body.treasuryType,
    cashAccount: req.body.cashAccount, bankAccount: req.body.bankAccount, performedBy: req.user._id,
  });
  item.refundedAmount = money(Number(item.refundedAmount || 0) + amount);
  item.refundJournal = posting.journalEntryId;
  item.refundedAt = new Date();
  item.updatedBy = req.user._id;
  await item.save();
  const invoice = await SalesInvoice.findById(item.salesInvoiceId);
  if (invoice) { invoice.refundDue = money(Math.max(Number(invoice.refundDue || 0) - amount, 0)); await invoice.save(); }
  await writeAudit({ actorId: req.user._id, action: "reverse", entityType: "SalesReturn", entityId: item._id, after: { refundedAmount: item.refundedAmount }, meta: { ...getReqMeta(req), amount } });
  return res.json({ success: true, data: item, posting });
};
