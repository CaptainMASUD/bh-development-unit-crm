import AccountingSettings from "../../models/accountingSettings.model.js";
import FiscalYear from "../../models/fiscalYear.model.js";
import VoucherSequence from "../../models/voucherSequence.model.js";

export const nextAccountingNumber = async (documentType = "journal", value = new Date()) => {
  const date = new Date(value || Date.now());
  const settings = await AccountingSettings.findOne({ key: "company" }).lean();
  const rule = settings?.numberingRules?.[documentType] || {};
  const legacyPrefix = documentType === "journal" ? settings?.voucherPrefix : "";
  const prefix = String(rule.prefix || legacyPrefix || documentType.toUpperCase()).trim().toUpperCase();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const fiscalYear = await FiscalYear.findOne({ startDate: { $lte: date }, endDate: { $gte: date } }).select("name").lean();
  const fy = fiscalYear?.name || String(year);
  const reset = rule.reset || settings?.voucherReset || "fiscal_year";
  const bucket = reset === "monthly" ? `${year}-${month}` : reset === "calendar_year" ? String(year) : reset === "fiscal_year" ? fy : "all";
  const sequence = await VoucherSequence.findOneAndUpdate({ sequenceKey: `${documentType}:${prefix}:${bucket}` }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
  const length = Number(rule.digitLength || settings?.voucherNumberLength || 6);
  const number = String(sequence.value).padStart(length, "0");
  return String(rule.format || settings?.voucherFormat || "{PREFIX}-{FY}-{NUMBER}")
    .replaceAll("{PREFIX}", prefix).replaceAll("{FY}", fy).replaceAll("{YYYY}", String(year)).replaceAll("{MM}", month).replaceAll("{NUMBER}", number);
};
