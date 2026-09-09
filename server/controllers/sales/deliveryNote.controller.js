import { DeliveryNote } from "../../models/sales/deliveryNote.model.js";
import { SalesOrder } from "../../models/sales/salesOrder.model.js";
import { nextSalesNumber } from "../../services/salesNumber.service.js";
import { issueInventory, cancelDeliveryInventory } from "../../services/salesIntegration.service.js";
import { runSalesTransaction } from "../../services/salesTransaction.service.js";
import { SalesError, assertTenant } from "../../utils/salesError.js";
import { getReqMeta, writeAudit } from "../../utils/audit.js";

const tenantFilter = (req, extra = {}) => ({
  tenantId: assertTenant(req),
  ...extra,
});

export const createDeliveryNote = async (req, res) => {
  const tenantId = assertTenant(req);
  let delivery;

  await runSalesTransaction(async (session) => {
      const order = await SalesOrder.findOne({
        _id: req.body.salesOrderId,
        tenantId,
      }).session(session);

      if (!order) throw new SalesError("Sales order not found.", 404);
      if (!["confirmed", "partially_fulfilled"].includes(order.status)) {
        throw new SalesError("Only a confirmed order can be delivered.", 409);
      }

      const requestedLines = Array.isArray(req.body.lines) && req.body.lines.length
        ? req.body.lines
        : order.lines
            .map((line) => ({
              orderLineId: line._id,
              quantity: Math.max(line.orderedQty - line.dispatchedQty, 0),
            }))
            .filter((line) => line.quantity > 0);

      if (!requestedLines.length) {
        throw new SalesError("There is no remaining quantity to deliver.", 409);
      }

      const orderLineMap = new Map(
        order.lines.map((line) => [String(line._id), line])
      );

      const lines = requestedLines.map((requested) => {
        const orderLine = orderLineMap.get(String(requested.orderLineId));
        if (!orderLine) {
          throw new SalesError(`Invalid orderLineId: ${requested.orderLineId}`);
        }

        const remaining = orderLine.orderedQty - orderLine.dispatchedQty;
        const quantity = Number(requested.quantity);

        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > remaining) {
          throw new SalesError(
            `Delivery quantity for ${orderLine.name} must be between 0 and ${remaining}.`
          );
        }

        return {
          orderLineId: orderLine._id,
          productId: orderLine.productId,
          variantId: orderLine.variantId,
          sku: orderLine.sku,
          name: orderLine.name,
          quantity,
          batchId: requested.batchId,
          serialNumbers: requested.serialNumbers || [],
        };
      });

      const deliveryNumber = await nextSalesNumber({
        tenantId,
        documentType: "delivery",
        session,
      });

      [delivery] = await DeliveryNote.create(
        [
          {
            tenantId,
            branchId: order.branchId,
            deliveryNumber,
            salesOrderId: order._id,
            leadId: order.leadId || undefined,
            dealId: order.dealId || undefined,
            customerId: order.customerId,
            warehouseId: req.body.warehouseId || order.warehouseId,
            status: "draft",
            lines,
            deliveryAddress: req.body.deliveryAddress || order.shippingAddress,
            deliveryMethod: req.body.deliveryMethod,
            courierName: req.body.courierName,
            trackingNumber: req.body.trackingNumber,
            vehicleNumber: req.body.vehicleNumber,
            driverName: req.body.driverName,
            driverPhone: req.body.driverPhone,
            scheduledDate: req.body.scheduledDate,
            notes: req.body.notes,
            createdBy: req.user._id,
            updatedBy: req.user._id,
          },
        ],
        { session }
      );
  });
  await writeAudit({ actorId: req.user._id, action: "create", entityType: "SalesDelivery", entityId: delivery._id, after: delivery.toObject(), meta: getReqMeta(req) });

  res.status(201).json({ success: true, data: delivery });
};

export const listDeliveryNotes = async (req, res) => {
  const filter = tenantFilter(req);
  if (req.query.salesOrderId) filter.salesOrderId = req.query.salesOrderId;
  if (req.query.customerId) filter.customerId = req.query.customerId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.warehouseId) filter.warehouseId = req.query.warehouseId;

  const items = await DeliveryNote.find(filter)
    .populate("customerId", "name companyName email phone")
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 50, 100))
    .lean();

  res.json({ success: true, data: items });
};

export const getDeliveryNote = async (req, res) => {
  const delivery = await DeliveryNote.findOne(
    tenantFilter(req, { _id: req.params.id })
  )
    .populate("salesOrderId", "orderNumber status")
    .populate("customerId", "name email phone")
    .populate("warehouseId", "name code");

  if (!delivery) throw new SalesError("Delivery note not found.", 404);
  res.json({ success: true, data: delivery });
};

export const updateDeliveryStatus = async (req, res) => {
  const transitions = {
    draft: ["picking", "cancelled"],
    picking: ["picked", "cancelled"],
    picked: ["packing", "cancelled"],
    packing: ["packed", "cancelled"],
    packed: ["ready_for_dispatch", "cancelled"],
    ready_for_dispatch: ["dispatched", "cancelled"],
    dispatched: ["in_transit", "delivered", "partially_delivered", "failed"],
    in_transit: ["delivered", "partially_delivered", "failed"],
    failed: ["ready_for_dispatch", "returned", "cancelled"],
    partially_delivered: [],
    delivered: [],
    returned: [],
    cancelled: [],
  };

  const delivery = await DeliveryNote.findOne(
    tenantFilter(req, { _id: req.params.id })
  );
  if (!delivery) throw new SalesError("Delivery note not found.", 404);

  const nextStatus = req.body.status;
  if (!transitions[delivery.status]?.includes(nextStatus)) {
    throw new SalesError(
      `Cannot change delivery from ${delivery.status} to ${nextStatus}.`,
      409
    );
  }

  if (nextStatus === "dispatched") {
    const issue = await issueInventory(req, {
      tenantId: delivery.tenantId,
      branchId: delivery.branchId,
      warehouseId: delivery.warehouseId,
      salesOrderId: delivery.salesOrderId,
      deliveryNoteId: delivery._id,
      referenceNumber: delivery.deliveryNumber,
      lines: delivery.lines.map((line) => ({
        orderLineId: line.orderLineId,
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        batchId: line.batchId,
        serialNumbers: line.serialNumbers,
      })),
      performedBy: req.user._id,
    });

    if (issue.status === "failed") {
      throw new SalesError(issue.message || "Inventory issue failed.", 409, issue);
    }

    delivery.inventoryPosting.status = issue.status;
    delivery.inventoryPosting.stockMovementId = issue.stockMovementId;
    delivery.inventoryPosting.message = issue.message;
    delivery.inventoryPosting.postedAt =
      issue.status === "posted" ? new Date() : undefined;
    delivery.dispatchedAt = new Date();

    const order = await SalesOrder.findOne({
      _id: delivery.salesOrderId,
      tenantId: delivery.tenantId,
    });

    if (order) {
      const map = new Map(order.lines.map((line) => [String(line._id), line]));
      delivery.lines.forEach((line) => {
        const orderLine = map.get(String(line.orderLineId));
        if (orderLine) {
          orderLine.dispatchedQty += line.quantity;
          orderLine.reservedQty = Math.max(
            orderLine.reservedQty - line.quantity,
            0
          );
        }
      });

      const allDispatched = order.lines.every(
        (line) => line.dispatchedQty >= line.orderedQty
      );
      order.fulfillmentStatus = allDispatched
        ? "dispatched"
        : "partially_dispatched";
      order.updatedBy = req.user._id;
      await order.save();
    }
  }

  const wasDispatched = ["dispatched", "in_transit"].includes(delivery.status);
  const isCancelledOrFailed = ["failed", "cancelled", "returned"].includes(nextStatus);

  if (wasDispatched && isCancelledOrFailed && delivery.inventoryPosting?.stockMovementId && delivery.inventoryPosting?.status === "posted") {
    await cancelDeliveryInventory(req, {
      tenantId: delivery.tenantId,
      stockMovementId: delivery.inventoryPosting.stockMovementId,
      reason: req.body.reason || `Delivery ${nextStatus}`,
      performedBy: req.user._id,
    });
    delivery.inventoryPosting.status = "reversed";
    delivery.inventoryPosting.message = `Stock movement reversed due to delivery ${nextStatus}`;

    const order = await SalesOrder.findOne({
      _id: delivery.salesOrderId,
      tenantId: delivery.tenantId,
    });

    if (order) {
      const map = new Map(order.lines.map((line) => [String(line._id), line]));
      delivery.lines.forEach((line) => {
        const orderLine = map.get(String(line.orderLineId));
        if (orderLine) {
          orderLine.dispatchedQty = Math.max(0, orderLine.dispatchedQty - line.quantity);
        }
      });
      const anyDispatched = order.lines.some((line) => line.dispatchedQty > 0);
      order.fulfillmentStatus = anyDispatched ? "partially_dispatched" : "reserved";
      order.updatedBy = req.user._id;
      await order.save();
    }
  }

  delivery.status = nextStatus;
  delivery.updatedBy = req.user._id;
  await delivery.save();
  await writeAudit({ actorId: req.user._id, action: "status_change", entityType: "SalesDelivery", entityId: delivery._id, after: { status: delivery.status, inventoryPosting: delivery.inventoryPosting }, meta: { ...getReqMeta(req), newStatus: delivery.status } });

  res.json({ success: true, data: delivery });
};

export const confirmDelivery = async (req, res) => {
  const tenantId = assertTenant(req);
  let result;

  await runSalesTransaction(async (session) => {
      const delivery = await DeliveryNote.findOne({
        _id: req.params.id,
        tenantId,
      }).session(session);

      if (!delivery) throw new SalesError("Delivery note not found.", 404);
      if (!["dispatched", "in_transit"].includes(delivery.status)) {
        throw new SalesError("Only a dispatched delivery can be confirmed.", 409);
      }
      if (delivery.orderDeliveryPosted) {
        throw new SalesError("Delivery has already been posted to the order.", 409);
      }

      const order = await SalesOrder.findOne({
        _id: delivery.salesOrderId,
        tenantId,
      }).session(session);

      if (!order) throw new SalesError("Sales order not found.", 404);

      const deliveredQuantities = new Map();
      if (Array.isArray(req.body.lines) && req.body.lines.length) {
        for (const item of req.body.lines) {
          deliveredQuantities.set(String(item.deliveryLineId), Number(item.deliveredQty));
        }
      }

      const orderLineMap = new Map(
        order.lines.map((line) => [String(line._id), line])
      );

      let allDeliveryLinesFullyReceived = true;

      for (const deliveryLine of delivery.lines) {
        const deliveredQty = deliveredQuantities.has(String(deliveryLine._id))
          ? deliveredQuantities.get(String(deliveryLine._id))
          : deliveryLine.quantity;

        if (
          !Number.isFinite(deliveredQty) ||
          deliveredQty < 0 ||
          deliveredQty > deliveryLine.quantity
        ) {
          throw new SalesError(
            `Invalid delivered quantity for ${deliveryLine.name}.`
          );
        }

        if (deliveredQty < deliveryLine.quantity) {
          allDeliveryLinesFullyReceived = false;
        }

        const orderLine = orderLineMap.get(String(deliveryLine.orderLineId));
        if (orderLine) orderLine.deliveredQty += deliveredQty;
      }

      const allOrderLinesDelivered = order.lines.every(
        (line) => line.deliveredQty >= line.orderedQty
      );

      order.fulfillmentStatus = allOrderLinesDelivered
        ? "delivered"
        : "partially_delivered";
      order.status = allOrderLinesDelivered
        ? "fulfilled"
        : "partially_fulfilled";
      order.updatedBy = req.user._id;

      delivery.status = allDeliveryLinesFullyReceived
        ? "delivered"
        : "partially_delivered";
      delivery.deliveredAt = new Date();
      delivery.orderDeliveryPosted = true;
      delivery.proofOfDelivery = {
        receiverName: req.body.receiverName,
        receiverPhone: req.body.receiverPhone,
        receivedAt: new Date(),
        signatureUrl: req.body.signatureUrl,
        photoUrl: req.body.photoUrl,
        otpVerified: Boolean(req.body.otpVerified),
        note: req.body.note,
      };
      delivery.updatedBy = req.user._id;

      await order.save({ session });
      await delivery.save({ session });
      result = delivery;
  });

  await writeAudit({ actorId: req.user._id, action: "confirm", entityType: "SalesDelivery", entityId: result._id, after: { status: result.status, proofOfDelivery: result.proofOfDelivery }, meta: getReqMeta(req) });
  res.json({ success: true, data: result });
};
