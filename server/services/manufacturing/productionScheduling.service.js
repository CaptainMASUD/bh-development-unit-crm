import ProductionSchedule from "../../models/manufacturing/productionSchedule.model.js";
import { nextManufacturingNumber } from "./manufacturingNumbering.service.js";
export const hasScheduleConflict = async ({ machine, workCenter, startAt, endAt, excludeId = null }) => {
  const filter = { status: { $in: ["scheduled", "locked", "in_progress"] }, startAt: { $lt: endAt }, endAt: { $gt: startAt } };
  if (machine) filter.machine = machine; else filter.workCenter = workCenter;
  if (excludeId) filter._id = { $ne: excludeId };
  return Boolean(await ProductionSchedule.exists(filter));
};
export const createSchedule = async ({ tenantId, data, userId = null }) => {
  if (await hasScheduleConflict(data)) throw Object.assign(new Error("The selected machine/work center already has an overlapping production schedule."), { statusCode: 409 });
  return ProductionSchedule.create({ tenantId, scheduleNumber: await nextManufacturingNumber({ tenantId, key: "schedule" }), ...data, createdBy:userId, updatedBy:userId });
};
