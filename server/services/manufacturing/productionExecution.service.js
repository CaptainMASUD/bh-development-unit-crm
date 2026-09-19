import Routing from "../../models/manufacturing/routing.model.js";
import WorkOrder from "../../models/manufacturing/workOrder.model.js";
import ManufacturingOrder from "../../models/manufacturing/manufacturingOrder.model.js";
import WIP from "../../models/manufacturing/wip.model.js";
import { nextManufacturingNumber } from "./manufacturingNumbering.service.js";

export const releaseManufacturingOrder = async ({ orderId, userId = null }) => {
  const order = await ManufacturingOrder.findById(orderId);
  if (!order) throw Object.assign(new Error("Manufacturing order not found."), { statusCode: 404 });
  if (!["draft", "planned"].includes(order.status)) throw Object.assign(new Error("Only draft or planned manufacturing orders can be released."), { statusCode: 409 });
  const routing = order.routing ? await Routing.findById(order.routing).lean() : null;
  if (routing?.operations?.length) {
    const existing = await WorkOrder.countDocuments({ manufacturingOrder: order._id });
    if (!existing) {
      for (const op of [...routing.operations].sort((a,b)=>a.sequence-b.sequence)) {
        await WorkOrder.create({ tenantId: order.tenantId, woNumber: await nextManufacturingNumber({ tenantId: order.tenantId, key: "wo" }), manufacturingOrder: order._id, operationId: op._id, sequence: op.sequence, operationName: op.name, workCenter: op.workCenter, machine: op.machine || null, plannedQuantity: order.quantity, setupMinutes: op.setupMinutes || 0, status: op.sequence === Math.min(...routing.operations.map(x=>x.sequence)) ? "ready" : "pending", createdBy: userId, updatedBy: userId });
      }
    }
  }
  order.status = "released";
  order.updatedBy = userId;
  await order.save();
  return order;
};

export const startWorkOrder = async ({ workOrderId, userId = null }) => {
  const wo = await WorkOrder.findById(workOrderId);
  if (!wo) throw Object.assign(new Error("Work order not found."), { statusCode: 404 });
  if (!["ready", "paused"].includes(wo.status)) throw Object.assign(new Error("Work order is not ready to start."), { statusCode: 409 });
  wo.status = "in_progress"; wo.actualStart ||= new Date(); wo.updatedBy = userId; await wo.save();
  await ManufacturingOrder.updateOne({ _id: wo.manufacturingOrder, status: { $in: ["released", "paused"] } }, { $set: { status: "in_progress", actualStart: new Date(), updatedBy: userId } });
  const mo = await ManufacturingOrder.findById(wo.manufacturingOrder).lean();
  await WIP.findOneAndUpdate({ manufacturingOrder: wo.manufacturingOrder, workOrder: wo._id }, { $setOnInsert: { tenantId: wo.tenantId, product: mo.product, enteredAt: new Date() }, $set: { workCenter: wo.workCenter, stage: wo.operationName, quantity: Math.max(0, wo.plannedQuantity - wo.completedQuantity), status: "active", updatedBy: userId } }, { upsert: true, new: true });
  return wo;
};

export const completeWorkOrder = async ({ workOrderId, completedQuantity, rejectedQuantity = 0, laborMinutes = 0, machineMinutes = 0, downtimeMinutes = 0, userId = null }) => {
  const wo = await WorkOrder.findById(workOrderId);
  if (!wo) throw Object.assign(new Error("Work order not found."), { statusCode: 404 });
  wo.completedQuantity = Number(completedQuantity ?? wo.completedQuantity); wo.rejectedQuantity = Number(rejectedQuantity || 0); wo.laborMinutes += Number(laborMinutes || 0); wo.machineMinutes += Number(machineMinutes || 0); wo.downtimeMinutes += Number(downtimeMinutes || 0); wo.status = "completed"; wo.actualEnd = new Date(); wo.updatedBy = userId; await wo.save();
  await WIP.updateOne({ manufacturingOrder: wo.manufacturingOrder, workOrder: wo._id }, { $set: { quantity: 0, status: "completed", exitedAt: new Date(), updatedBy: userId } });
  const next = await WorkOrder.findOne({ manufacturingOrder: wo.manufacturingOrder, sequence: { $gt: wo.sequence }, status: "pending" }).sort({ sequence: 1 });
  if (next) { next.status = "ready"; next.updatedBy = userId; await next.save(); }
  return wo;
};
