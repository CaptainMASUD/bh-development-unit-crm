import { SalesOrder } from "../../models/sales/salesOrder.model.js";
import {
  reserveInventory,
  releaseInventory,
  logCrmActivity,
} from "../../services/salesIntegration.service.js";
import { SalesError, assertTenant } from "../../utils/salesError.js";
import { assertCustomerCreditAvailable, validateSalesWarehouse } from "../../services/salesReference.service.js";
import { getReqMeta, writeAudit } from "../../utils/audit.js";

const tenantFilter = (req, extra = {}) => ({
  tenantId: assertTenant(req),
  ...extra,
});

export const listSalesOrders = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const filter = tenantFilter(req);

  for (const field of [
    "status",
    "customerId",
    "salespersonId",
    "warehouseId",
    "fulfillmentStatus",
    "invoiceStatus",
    "paymentStatus",
  ]) {
    if (req.query[field]) filter[field] = req.query[field];
  }

  if (req.query.search) {
    filter.$or = [
      { orderNumber: { $regex: req.query.search, $options: "i" } },
      { customerReference: { $regex: req.query.search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    SalesOrder.find(filter)
      .populate("customerId", "name companyName email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SalesOrder.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getSalesOrder = async (req, res) => {
  const order = await SalesOrder.findOne(
    tenantFilter(req, { _id: req.params.id })
  )
    .populate("customerId", "name email phone")
    .populate("salespersonId", "name email")
    .populate("warehouseId", "name code")
    .populate("quotationId", "quotationNumber status");

  if (!order) throw new SalesError("Sales order not found.", 404);
  res.json({ success: true, data: order });
};

export const updateSalesOrder = async (req, res) => {
  const order = await SalesOrder.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!order) throw new SalesError("Sales order not found.", 404);
  if (!["draft", "pending_approval"].includes(order.status)) {
    throw new SalesError(`Order cannot be edited while status is ${order.status}.`, 409);
  }

  const allowed = [
    "contactId",
    "salespersonId",
    "warehouseId",
    "promisedDeliveryDate",
    "billingAddress",
    "shippingAddress",
    "paymentTerms",
    "deliveryTerms",
    "customerReference",
    "notes",
  ];

  for (const field of allowed) {
    if (req.body[field] !== undefined) order[field] = req.body[field];
  }
  await validateSalesWarehouse({ warehouseId: order.warehouseId, branchId: order.branchId });

  order.updatedBy = req.user._id;
  await order.save();
  await writeAudit({ actorId: req.user._id, action: "update", entityType: "SalesOrder", entityId: order._id, after: order.toObject(), meta: getReqMeta(req) });
  res.json({ success: true, data: order });
};

export const submitSalesOrderForApproval = async (req, res) => {
  const order = await SalesOrder.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!order) throw new SalesError("Sales order not found.", 404);
  if (order.status !== "draft") {
    throw new SalesError("Only a draft order can be submitted.", 409);
  }

  order.status = "pending_approval";
  order.approval.requestedAt = new Date();
  order.approval.requestedBy = req.user._id;
  order.updatedBy = req.user._id;
  await order.save();
  await writeAudit({ actorId: req.user._id, action: "submit", entityType: "SalesOrder", entityId: order._id, after: { status: order.status }, meta: getReqMeta(req) });

  res.json({ success: true, data: order });
};

export const approveSalesOrder = async (req, res) => {
  const order = await SalesOrder.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!order) throw new SalesError("Sales order not found.", 404);
  if (order.status !== "pending_approval") {
    throw new SalesError("Only a pending order can be approved.", 409);
  }

  order.status = "approved";
  order.approval.approvedAt = new Date();
  order.approval.approvedBy = req.user._id;
  order.approval.rejectedAt = undefined;
  order.approval.rejectedBy = undefined;
  order.approval.rejectionReason = undefined;
  order.updatedBy = req.user._id;
  await order.save();
  await writeAudit({ actorId: req.user._id, action: "approve", entityType: "SalesOrder", entityId: order._id, after: { status: order.status }, meta: getReqMeta(req) });

  res.json({ success: true, data: order });
};

export const rejectSalesOrder = async (req, res) => {
  const order = await SalesOrder.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!order) throw new SalesError("Sales order not found.", 404);
  if (order.status !== "pending_approval") {
    throw new SalesError("Only a pending order can be rejected.", 409);
  }
  if (!req.body.reason) throw new SalesError("Rejection reason is required.");

  order.status = "draft";
  order.approval.rejectedAt = new Date();
  order.approval.rejectedBy = req.user._id;
  order.approval.rejectionReason = req.body.reason;
  order.updatedBy = req.user._id;
  await order.save();
  await writeAudit({ actorId: req.user._id, action: "reject", entityType: "SalesOrder", entityId: order._id, after: { status: order.status, rejectionReason: order.approval.rejectionReason }, meta: getReqMeta(req) });

  res.json({ success: true, data: order });
};

export const confirmSalesOrder = async (req, res) => {
  const order = await SalesOrder.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!order) throw new SalesError("Sales order not found.", 404);

  if (order.status !== "approved") {
    throw new SalesError("The order must be approved before confirmation.", 409);
  }

  await assertCustomerCreditAvailable({ customerId: order.customerId, orderAmount: order.totals.grandTotal });

  const reservation = await reserveInventory(req, {
    tenantId: order.tenantId,
    branchId: order.branchId,
    warehouseId: order.warehouseId,
    salesOrderId: order._id,
    referenceNumber: order.orderNumber,
    lines: order.lines.map((line) => ({
      orderLineId: line._id,
      productId: line.productId,
      variantId: line.variantId,
      warehouseId: line.warehouseId || order.warehouseId,
      quantity: line.orderedQty,
    })),
    performedBy: req.user._id,
  });

  if (reservation.status === "failed") {
    throw new SalesError(
      reservation.message || "Inventory reservation failed.",
      409,
      reservation
    );
  }

  order.status = "confirmed";
  order.confirmation.confirmedAt = new Date();
  order.confirmation.confirmedBy = req.user._id;
  order.inventoryReservation.status = reservation.status;
  order.inventoryReservation.reservationId = reservation.reservationId;
  order.inventoryReservation.message = reservation.message;
  order.inventoryReservation.reservedAt =
    reservation.status === "reserved" || reservation.status === "partial"
      ? new Date()
      : undefined;

  if (reservation.status === "reserved") {
    order.fulfillmentStatus = "reserved";
    order.lines.forEach((line) => {
      line.reservedQty = line.orderedQty;
    });
  } else if (reservation.status === "partial" && reservation.lines) {
    order.fulfillmentStatus = "reserved";
    const byLine = new Map(
      reservation.lines.map((line) => [
        String(line.orderLineId),
        Number(line.reservedQty || 0),
      ])
    );
    order.lines.forEach((line) => {
      line.reservedQty = byLine.get(String(line._id)) || 0;
    });
  }

  order.updatedBy = req.user._id;
  await order.save();

  await logCrmActivity(req, {
    tenantId: order.tenantId,
    dealId: order.dealId,
    customerId: order.customerId,
    type: "sales_order_confirmed",
    description: `${order.orderNumber} confirmed`,
    performedBy: req.user._id,
  });
  await writeAudit({ actorId: req.user._id, action: "confirm", entityType: "SalesOrder", entityId: order._id, after: { status: order.status, inventoryReservation: order.inventoryReservation }, meta: getReqMeta(req) });

  res.json({ success: true, data: order, integration: reservation });
};

export const cancelSalesOrder = async (req, res) => {
  const order = await SalesOrder.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!order) throw new SalesError("Sales order not found.", 404);
  if (["fulfilled", "closed", "cancelled"].includes(order.status)) {
    throw new SalesError(`Cannot cancel an order with status ${order.status}.`, 409);
  }
  if (order.lines.some((line) => line.dispatchedQty > 0 || line.deliveredQty > 0)) {
    throw new SalesError("An order with dispatched goods must use a return process.", 409);
  }
  if (!req.body.reason) throw new SalesError("Cancellation reason is required.");

  const release = await releaseInventory(req, {
    tenantId: order.tenantId,
    salesOrderId: order._id,
    reservationId: order.inventoryReservation.reservationId,
    performedBy: req.user._id,
  });

  order.status = "cancelled";
  order.inventoryReservation.status = "released";
  order.cancelledAt = new Date();
  order.cancelledBy = req.user._id;
  order.cancellationReason = req.body.reason;
  order.updatedBy = req.user._id;
  await order.save();
  await writeAudit({ actorId: req.user._id, action: "cancel", entityType: "SalesOrder", entityId: order._id, after: { status: order.status }, meta: { ...getReqMeta(req), reason: req.body.reason } });

  res.json({ success: true, data: order, integration: release });
};

export const closeSalesOrder = async (req, res) => {
  const order = await SalesOrder.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!order) throw new SalesError("Sales order not found.", 404);

  const allDelivered = order.lines.every(
    (line) => line.deliveredQty >= line.orderedQty - line.returnedQty
  );
  const fullyInvoiced = order.invoiceStatus === "fully_invoiced";

  if (!allDelivered || !fullyInvoiced) {
    throw new SalesError(
      "Order can be closed only after full delivery and full invoicing.",
      409
    );
  }

  order.status = "closed";
  order.updatedBy = req.user._id;
  await order.save();
  await writeAudit({ actorId: req.user._id, action: "close", entityType: "SalesOrder", entityId: order._id, after: { status: order.status }, meta: getReqMeta(req) });

  res.json({ success: true, data: order });
};
