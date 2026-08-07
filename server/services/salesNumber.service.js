import { SalesSequence } from "../models/sales/salesSequence.model.js";

const pad = (value, width = 6) => String(value).padStart(width, "0");

export const nextSalesNumber = async ({
  tenantId,
  documentType,
  session = null,
  date = new Date(),
}) => {
  const prefixes = {
    quotation: "QTN",
    order: "SO",
    delivery: "DN",
    invoice: "INV",
    return: "SRT",
  };

  const prefix = prefixes[documentType];
  if (!prefix) {
    throw new Error(`Unsupported sales document type: ${documentType}`);
  }

  const period = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  const key = `${documentType}:${period}`;

  const sequence = await SalesSequence.findOneAndUpdate(
    { tenantId, key },
    { $inc: { current: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      session,
    }
  );

  return `${prefix}-${period}-${pad(sequence.current)}`;
};
