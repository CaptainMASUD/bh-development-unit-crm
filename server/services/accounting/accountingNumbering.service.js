import FiscalYear from "../../models/fiscalYear.model.js";
import { assignDocumentNumber } from "../administration/documentNumbering.service.js";

export const nextAccountingNumber = async (documentType = "journal", value = new Date(), { tenantId, session, providedValue } = {}) => {
  const typeKey = {
    journal: "accounting.journal", voucher: "accounting.voucher", payment: "accounting.voucher",
    receipt: "accounting.voucher", contra: "accounting.voucher", adjustment: "accounting.voucher",
    bill: "accounting.bill", deal: "crm.deal",
  }[documentType];
  if (!typeKey) throw Object.assign(new Error(`Unsupported accounting number type: ${documentType}`), { statusCode: 400 });
  if (!tenantId) throw Object.assign(new Error("Verified tenant is required for accounting numbering"), { statusCode: 403 });
  const date = new Date(value || Date.now());
  const fiscalYear = documentType === "deal" ? null : await FiscalYear.findOne({ startDate: { $lte: date }, endDate: { $gte: date } }).select("name").lean();
  return (await assignDocumentNumber({
    tenantId, typeKey, date, session, providedValue,
    context: { fiscalYearName: fiscalYear?.name || String(date.getUTCFullYear()) },
    source: "accounting.numbering",
  })).value;
};
