import { assignDocumentNumber } from "../administration/documentNumbering.service.js";
const TYPES = Object.freeze({
  bom: "bom", routing: "routing", plan: "plan", mrp: "mrp", mo: "mo", wo: "wo", issue: "issue",
  entry: "entry", inspection: "inspection", ncr: "ncr", scrap: "scrap", rework: "rework",
  schedule: "schedule", maintenancePlan: "maintenance-plan", maintenanceOrder: "maintenance-order",
  subcontract: "subcontract", cost: "cost",
});
export const nextManufacturingNumber = async ({ tenantId, key, session = null, date = new Date(), providedValue, idempotencyKey } = {}) => {
  const type = TYPES[key];
  if (!type) throw new Error(`Unsupported manufacturing document type: ${key}`);
  const allocation = await assignDocumentNumber({
    tenantId, typeKey: `manufacturing.${type}`, session, date, providedValue,
    idempotencyKey, source: "manufacturing",
  });
  return allocation.value;
};
