import { SalesError } from "../utils/salesError.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const calculateLine = (line, quantityField = "quantity", taxCalculationMethod = "exclusive") => {
  const quantity = Number(line[quantityField] ?? line.quantity ?? 0);
  const unitPrice = Number(line.unitPrice ?? 0);
  const discountType = line.discountType || "fixed";
  const discountValue = Number(line.discountValue ?? 0);
  const taxRate = Number(line.taxRate ?? 0);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new SalesError("Every sales line must have a quantity greater than 0.");
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new SalesError("Unit price cannot be negative.");
  }
  if (!["fixed", "percentage"].includes(discountType)) {
    throw new SalesError("discountType must be fixed or percentage.");
  }
  if (discountType === "percentage" && (discountValue < 0 || discountValue > 100)) {
    throw new SalesError("Percentage discount must be between 0 and 100.");
  }
  if (taxRate < 0 || taxRate > 100) {
    throw new SalesError("Tax rate must be between 0 and 100.");
  }

  const lineSubtotal = round2(quantity * unitPrice);
  const rawDiscount =
    discountType === "percentage"
      ? lineSubtotal * (discountValue / 100)
      : discountValue;

  const lineDiscount = round2(Math.min(Math.max(rawDiscount, 0), lineSubtotal));
  const taxableAmount = round2(lineSubtotal - lineDiscount);
  const inclusive = taxCalculationMethod === "inclusive";
  const lineTax = inclusive
    ? round2(taxableAmount - taxableAmount / (1 + taxRate / 100))
    : round2(taxableAmount * (taxRate / 100));
  const lineTotal = inclusive ? taxableAmount : round2(taxableAmount + lineTax);

  return {
    ...line,
    [quantityField]: quantity,
    unitPrice,
    discountType,
    discountValue,
    taxRate,
    lineSubtotal,
    lineDiscount,
    lineTax,
    lineTotal,
  };
};

export const calculateDocument = (
  lines,
  { shippingCharge = 0, adjustment = 0, quantityField = "quantity", taxCalculationMethod = "exclusive" } = {}
) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new SalesError("At least one sales line is required.");
  }

  const calculatedLines = lines.map((line) =>
    calculateLine(line, quantityField, taxCalculationMethod)
  );

  const subtotal = round2(
    calculatedLines.reduce((sum, line) => sum + line.lineSubtotal, 0)
  );
  const discountTotal = round2(
    calculatedLines.reduce((sum, line) => sum + line.lineDiscount, 0)
  );
  const taxTotal = round2(
    calculatedLines.reduce((sum, line) => sum + line.lineTax, 0)
  );
  const normalizedShipping = round2(shippingCharge);
  const normalizedAdjustment = round2(adjustment);
  const grandTotal = round2(
    subtotal - discountTotal + (taxCalculationMethod === "inclusive" ? 0 : taxTotal) + normalizedShipping + normalizedAdjustment
  );

  return {
    lines: calculatedLines,
    totals: {
      subtotal,
      discountTotal,
      taxTotal,
      shippingCharge: normalizedShipping,
      adjustment: normalizedAdjustment,
      grandTotal,
      taxCalculationMethod,
    },
  };
};

export const roundMoney = round2;
