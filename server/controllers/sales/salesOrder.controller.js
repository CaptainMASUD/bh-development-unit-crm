import { SalesOrder } from "../../models/sales/salesOrder.model.js";
import Deal from "../../models/deal.model.js";
import Customer from "../../models/customer.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import Product from "../../models/inventory/product.model.js";
import Branch from "../../models/branch.model.js";
import {
  reserveInventory,
  releaseInventory,
  logCrmActivity,
} from "../../services/salesIntegration.service.js";
import { nextSalesNumber } from "../../services/salesNumber.service.js";
import { assignDocumentNumber } from "../../services/administration/documentNumbering.service.js";
import { runSalesTransaction } from "../../services/salesTransaction.service.js";
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
    leadId: order.leadId,
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

export const createSalesOrderFromDeal = async (req, res) => {
  const tenantId = assertTenant(req);
  const dealId = req.params.dealId;

  const deal = await Deal.findOne(tenantFilter(req, { _id: dealId }));
  if (!deal) throw new SalesError("Deal not found.", 404);
  if (deal.stage !== "won") throw new SalesError("Only won deals can be converted to a sales order.", 409);
  if (!deal.customerId) throw new SalesError("This deal has no associated customer.", 409);

  if (deal.salesOrderId) {
    const existing = await SalesOrder.findOne(tenantFilter(req, { _id: deal.salesOrderId }));
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A sales order already exists for this deal.",
        data: existing,
      });
    }
  }

  let branchId = req.body.branchId || req.membership?.defaultBranch || req.user.defaultBranch;
  if (!branchId) {
    const defaultBranch = await Branch.findOne(tenantFilter(req, { isDefault: true, isActive: true })).lean()
      || await Branch.findOne(tenantFilter(req, { isActive: true })).lean()
      || await Branch.findOne({ isDefault: true, isActive: true }).lean()
      || await Branch.findOne({ isActive: true }).lean();
    branchId = defaultBranch?._id;
  }
  if (!branchId) throw new SalesError("branchId is required.");

  let warehouseId = req.body.warehouseId;
  if (!warehouseId) {
    const defaultWh = await Warehouse.findOne({ branch: branchId, status: "active", isDefault: true }).lean()
      || await Warehouse.findOne({ branch: branchId, status: "active" }).lean()
      || await Warehouse.findOne({ status: "active" }).lean();
    warehouseId = defaultWh?._id;
  }
  if (!warehouseId) throw new SalesError("warehouseId is required to create the sales order.", 400);

  const customer = await Customer.findById(deal.customerId).lean();
  if (!customer) throw new SalesError("Customer not found.", 404);

  let createdOrder;
  await runSalesTransaction(async (session) => {
    const orderNumber = await nextSalesNumber({
      tenantId,
      documentType: "order",
      session,
      providedValue: req.body.orderNumber,
    });

    const dealLines = Array.isArray(deal.items) && deal.items.length ? deal.items : [];
    const productIds = dealLines.map((item) => item.productId).filter(Boolean);
    const products = productIds.length ? await Product.find({ _id: { $in: productIds } }).session(session).lean() : [];
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const lines = [];
    for (let index = 0; index < dealLines.length; index++) {
      const item = dealLines[index];
      let prod = item.productId ? productMap.get(String(item.productId)) : null;

      if (!prod && item.nameSnapshot) {
        prod = await Product.findOne(tenantFilter(req, {
          name: { $regex: new RegExp(`^${item.nameSnapshot.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
          status: "active",
        })).session(session);
      }

      if (!prod) {
        const name = item.nameSnapshot?.trim() || `Deal Item ${index + 1}`;
        const { value: sku } = await assignDocumentNumber({
          tenantId, typeKey: "inventory.product", context: { categoryCode: "SVC" },
          session, source: "sales.deal.service-product",
        });
        const [created] = await Product.create(
          [
            {
              tenantId,
              name,
              sku,
              productType: "service",
              trackInventory: false,
              sellingPrice: Number(item.unitPrice || 0),
              minimumSellingPrice: 0,
              status: "active",
              createdBy: req.user._id,
              updatedBy: req.user._id,
            },
          ],
          { session }
        );
        prod = created;
      }

      if (!item.productId) {
        item.productId = prod._id;
      }

      const orderedQty = Math.max(Number(item.qty || 1), 0.000001);
      const unitPrice = Number(item.unitPrice || prod?.sellingPrice || 0);
      const lineDiscount = Number(item.discount || 0);
      const taxRate = Number(prod?.taxRate || 0);
      const lineSubtotal = Math.round(orderedQty * unitPrice * 100) / 100;
      const lineTax = Math.round((lineSubtotal - lineDiscount) * (taxRate / 100) * 100) / 100;
      const lineTotal = Math.round((lineSubtotal - lineDiscount + lineTax) * 100) / 100;

      lines.push({
        productId: prod._id,
        name: item.nameSnapshot || prod?.name || "Item",
        sku: prod?.sku || "",
        warehouseId,
        orderedQty,
        reservedQty: 0,
        dispatchedQty: 0,
        deliveredQty: 0,
        invoicedQty: 0,
        returnedQty: 0,
        unitPrice,
        taxRate,
        lineSubtotal,
        lineDiscount,
        lineTax,
        lineTotal,
      });
    }

    if (!lines.length) {
      const name = deal.title || "Custom Deal Service";
      const { value: sku } = await assignDocumentNumber({
        tenantId, typeKey: "inventory.product", context: { categoryCode: "SVC" },
        session, source: "sales.deal.service-product",
      });
      const [created] = await Product.create(
        [
          {
            tenantId,
            name,
            sku,
            productType: "service",
            trackInventory: false,
            sellingPrice: Number(deal.grandTotal || 0),
            minimumSellingPrice: 0,
            status: "active",
            createdBy: req.user._id,
            updatedBy: req.user._id,
          },
        ],
        { session }
      );
      lines.push({
        productId: created._id,
        name,
        sku,
        warehouseId,
        orderedQty: 1,
        reservedQty: 0,
        dispatchedQty: 0,
        deliveredQty: 0,
        invoicedQty: 0,
        returnedQty: 0,
        unitPrice: Number(deal.grandTotal || 0),
        taxRate: 0,
        lineSubtotal: Number(deal.grandTotal || 0),
        lineDiscount: 0,
        lineTax: 0,
        lineTotal: Number(deal.grandTotal || 0),
      });
    }

    const subtotal = lines.reduce((acc, l) => acc + l.lineSubtotal, 0);
    const taxTotal = lines.reduce((acc, l) => acc + l.lineTax, 0);
    const discountTotal = lines.reduce((acc, l) => acc + l.lineDiscount, 0);
    const grandTotal = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100;

    await assertCustomerCreditAvailable({ customerId: deal.customerId, orderAmount: grandTotal });

    const [order] = await SalesOrder.create(
      [
        {
          tenantId,
          branchId,
          orderNumber,
          dealId: deal._id,
          leadId: deal.leadId || undefined,
          customerId: deal.customerId,
          salespersonId: deal.ownerId || req.user._id,
          warehouseId,
          currency: deal.currency || "BDT",
          status: "draft",
          orderDate: new Date(),
          lines,
          totals: {
            subtotal,
            discountTotal,
            taxTotal,
            grandTotal,
            roundOff: 0,
          },
          billingAddress: customer.billingAddress || {},
          shippingAddress: customer.shippingAddress || {},
          paymentTermsDays: customer.paymentTermsDays || 0,
          createdBy: req.user._id,
          updatedBy: req.user._id,
        },
      ],
      { session }
    );

    deal.salesOrderId = order._id;
    await deal.save({ session });
    createdOrder = order;
  });

  await writeAudit({
    actorId: req.user._id,
    action: "create",
    entityType: "SalesOrder",
    entityId: createdOrder._id,
    after: createdOrder.toObject(),
    meta: { ...getReqMeta(req), dealId: deal._id, source: "deal_conversion" },
  });

  res.status(201).json({ success: true, data: createdOrder });
};
