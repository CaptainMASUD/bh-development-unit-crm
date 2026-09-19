import MRPRun from "../../models/manufacturing/mrpRun.model.js";
import ProductionPlan from "../../models/manufacturing/productionPlan.model.js";
import ProductStock from "../../models/inventory/productStock.model.js";
import Product from "../../models/inventory/product.model.js";
import { explodeBom } from "./bomExplosion.service.js";
import { nextManufacturingNumber } from "./manufacturingNumbering.service.js";

const round = v => Math.round(Number(v || 0) * 1e6) / 1e6;
export const calculateNetRequirement = ({ grossRequirement, available, incoming = 0, safetyStock = 0 }) =>
  Math.max(0, round(Number(grossRequirement || 0) + Number(safetyStock || 0) - Number(available || 0) - Number(incoming || 0)));

export const runMrp = async ({ tenantId, productionPlanId, userId = null }) => {
  const plan = await ProductionPlan.findById(productionPlanId).lean();
  if (!plan) throw Object.assign(new Error("Production plan not found."), { statusCode: 404 });
  if (!["approved", "mrp_run", "released"].includes(plan.status)) throw Object.assign(new Error("Production plan must be approved before MRP can run."), { statusCode: 409 });
  const totals = new Map();
  const warnings = [];
  for (const line of plan.lines || []) {
    try {
      const exploded = await explodeBom({ productId: line.product, quantity: line.plannedQuantity, bomId: line.bom || null });
      for (const req of exploded.requirements) {
        const key = String(req.product);
        const row = totals.get(key) || { product: req.product, grossRequirement: 0, requiredDate: line.requiredDate || plan.periodEnd || null };
        row.grossRequirement = round(row.grossRequirement + Number(req.quantity || 0));
        totals.set(key, row);
      }
    } catch (error) { warnings.push(`${line.product}: ${error.message}`); }
  }
  const requirements = [];
  for (const row of totals.values()) {
    const stocks = await ProductStock.find({ product: row.product, status: "active" }).select("onHandQuantity reservedQuantity availableQuantity incomingQuantity").lean();
    const onHand = round(stocks.reduce((s,x)=>s+Number(x.onHandQuantity||0),0));
    const reserved = round(stocks.reduce((s,x)=>s+Number(x.reservedQuantity||0),0));
    const available = round(stocks.reduce((s,x)=>s+Number(x.availableQuantity||0),0));
    const incoming = round(stocks.reduce((s,x)=>s+Number(x.incomingQuantity||0),0));
    const product = await Product.findById(row.product).select("minimumStock defaultSupplier").lean();
    const safetyStock = Number(product?.minimumStock || 0);
    const netRequirement = calculateNetRequirement({ grossRequirement: row.grossRequirement, available, incoming, safetyStock });
    requirements.push({ ...row, onHand, reserved, available, incoming, safetyStock, netRequirement, recommendedPurchaseQuantity: netRequirement, recommendedProductionQuantity: 0, defaultSupplier: product?.defaultSupplier || null });
  }
  const runNumber = await nextManufacturingNumber({ tenantId, key: "mrp" });
  const run = await MRPRun.create({ tenantId, runNumber, productionPlan: productionPlanId, status: "completed", requirements, warnings, createdBy: userId, updatedBy: userId });
  await ProductionPlan.updateOne({ _id: productionPlanId }, { $set: { status: "mrp_run", updatedBy: userId } });
  return run;
};
