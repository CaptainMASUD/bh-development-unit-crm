import ProductStock from "../../models/inventory/productStock.model.js";
import BillOfMaterial from "../../models/manufacturing/billOfMaterial.model.js";
import Routing from "../../models/manufacturing/routing.model.js";
import ProductionPlan from "../../models/manufacturing/productionPlan.model.js";
import { nextManufacturingNumber } from "./manufacturingNumbering.service.js";

export const buildPlanLine = ({ demandQuantity = 0, availableQuantity = 0, safetyStock = 0 }) => ({
  plannedQuantity: Math.max(0, Number(demandQuantity || 0) + Number(safetyStock || 0) - Number(availableQuantity || 0)),
});

export const createProductionPlanFromDemand = async ({ tenantId, lines, name = "", userId = null }) => {
  const enriched = [];
  for (const line of lines || []) {
    const stocks = await ProductStock.find({ product: line.product, status: "active" }).select("availableQuantity").lean();
    const available = stocks.reduce((s, x) => s + Number(x.availableQuantity || 0), 0);
    const planned = line.plannedQuantity ?? buildPlanLine({ demandQuantity: line.demandQuantity, availableQuantity: available, safetyStock: line.safetyStock }).plannedQuantity;
    if (planned <= 0) continue;
    const bom = line.bom || (await BillOfMaterial.findOne({ product: line.product, status: "active" }).sort({ version: -1 }).select("_id").lean())?._id;
    const routing = line.routing || (await Routing.findOne({ product: line.product, status: "active" }).sort({ version: -1 }).select("_id").lean())?._id;
    enriched.push({ ...line, availableQuantity: available, plannedQuantity: planned, bom, routing });
  }
  const planNumber = await nextManufacturingNumber({ tenantId, key: "plan" });
  return ProductionPlan.create({ tenantId, planNumber, name, lines: enriched, createdBy: userId, updatedBy: userId });
};
