import ManufacturingSequence from "../../models/manufacturing/manufacturingSequence.model.js";
const PREFIX = Object.freeze({
  bom: "BOM", routing: "RT", plan: "PP", mrp: "MRP", mo: "MO", wo: "WO", issue: "MI",
  entry: "PE", inspection: "QI", ncr: "NCR", scrap: "SCR", rework: "RW", schedule: "SCH",
  maintenancePlan: "MP", maintenanceOrder: "MT", subcontract: "SUB", cost: "MC",
});
export const nextManufacturingNumber = async ({ tenantId, key, session = null, date = new Date() }) => {
  const sequenceKey = String(key || "DOC").trim().toUpperCase();
  const query = ManufacturingSequence.findOneAndUpdate(
    { tenantId, key: sequenceKey },
    { $inc: { value: 1 }, $setOnInsert: { tenantId, key: sequenceKey } },
    { new: true, upsert: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) }
  );
  const row = await query.lean();
  const prefix = PREFIX[key] || sequenceKey;
  const year = new Date(date).getUTCFullYear();
  return `${prefix}-${year}-${String(row.value).padStart(6, "0")}`;
};
