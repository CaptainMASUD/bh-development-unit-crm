import ManufacturingOrder from "../../models/manufacturing/manufacturingOrder.model.js";
import WorkOrder from "../../models/manufacturing/workOrder.model.js";
import ScrapEntry from "../../models/manufacturing/scrapEntry.model.js";
import QualityInspection from "../../models/manufacturing/qualityInspection.model.js";
import Machine from "../../models/manufacturing/machine.model.js";
export const getManufacturingDashboard = async () => {
  const [orders, work, scrap, quality, machines] = await Promise.all([
    ManufacturingOrder.aggregate([{ $group:{_id:"$status",count:{$sum:1},quantity:{$sum:"$quantity"},completed:{$sum:"$completedQuantity"}} }]),
    WorkOrder.aggregate([{ $group:{_id:null,laborMinutes:{$sum:"$laborMinutes"},machineMinutes:{$sum:"$machineMinutes"},downtimeMinutes:{$sum:"$downtimeMinutes"}} }]),
    ScrapEntry.aggregate([{ $match:{status:{$ne:"cancelled"}} },{$group:{_id:null,quantity:{$sum:"$quantity"},recoveryValue:{$sum:"$recoveryValue"}}}]),
    QualityInspection.aggregate([{ $group:{_id:"$result",count:{$sum:1},passed:{$sum:"$quantityPassed"},failed:{$sum:"$quantityFailed"}} }]),
    Machine.aggregate([{ $group:{_id:"$status",count:{$sum:1}} }]),
  ]);
  return {orders,work:work[0]||{laborMinutes:0,machineMinutes:0,downtimeMinutes:0},scrap:scrap[0]||{quantity:0,recoveryValue:0},quality,machines};
};
