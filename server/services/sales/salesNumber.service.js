import { assignDocumentNumber } from "../administration/documentNumbering.service.js";

export const nextSalesNumber = async ({
  tenantId,
  documentType,
  session = null,
  date = new Date(),
  providedValue,
  idempotencyKey,
}) => {
  if (!["quotation", "order", "delivery", "invoice", "return"].includes(documentType)) {
    throw new Error(`Unsupported sales document type: ${documentType}`);
  }
  const allocation = await assignDocumentNumber({
    tenantId, typeKey: `sales.${documentType}`, session, date,
    providedValue, idempotencyKey, source: "sales",
  });
  return allocation.value;
};
