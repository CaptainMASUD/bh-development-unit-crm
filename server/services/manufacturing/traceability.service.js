import ManufacturingOrder from "../../models/manufacturing/manufacturingOrder.model.js";
import MaterialIssue from "../../models/manufacturing/materialIssue.model.js";
import ProductionEntry from "../../models/manufacturing/productionEntry.model.js";
import QualityInspection from "../../models/manufacturing/qualityInspection.model.js";
import StockMovement from "../../models/inventory/stockMovement.model.js";
export const getManufacturingTrace = async ({ manufacturingOrderId }) => {
  const order=await ManufacturingOrder.findById(manufacturingOrderId).populate("product","name sku trackingType").lean();
  if(!order) throw Object.assign(new Error("Manufacturing order not found."),{statusCode:404});
  const issues=await MaterialIssue.find({manufacturingOrder:order._id}).lean();
  const entries=await ProductionEntry.find({manufacturingOrder:order._id}).lean();
  const inspections=await QualityInspection.find({manufacturingOrder:order._id}).lean();
  const movementIds=[...issues.map(x=>x.stockMovement),...entries.map(x=>x.stockMovement)].filter(Boolean);
  const movements=await StockMovement.find({_id:{$in:movementIds}}).lean();
  return {order,issues,entries,inspections,movements};
};
