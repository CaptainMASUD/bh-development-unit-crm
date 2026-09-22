import mongoose from "mongoose";
import PaymentTerm, {
  PAYMENT_TERM_TYPES,
  CALCULATION_TYPES,
  DUE_RULES,
  MILESTONE_TYPES,
} from "../../models/accounting/paymentTerm.model.js";
import AccountingSettings from "../../models/accounting/accountingSettings.model.js";
import Customer from "../../models/crm/customer.model.js";
import Supplier from "../../models/supplier/supplier.model.js";
import { writeAudit } from "../../utils/audit.js";

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const DAY_MS = 24 * 60 * 60 * 1000;

export const STANDARD_TERMS_SEED = [
  {
    code: "IMMEDIATE",
    name: "Due Immediately",
    description: "Payment due upon document issue",
    termType: "IMMEDIATE",
    isSystem: true,
    applicableTo: "all",
    rules: [
      {
        sequence: 1,
        description: "100% Due Immediately",
        calculationType: "PERCENTAGE",
        value: 100,
        dueRule: "IMMEDIATE",
        days: 0,
      },
    ],
  },
  {
    code: "NET7",
    name: "Net 7",
    description: "Full payment due within 7 days",
    termType: "NET_DAYS",
    isSystem: true,
    applicableTo: "all",
    rules: [
      {
        sequence: 1,
        description: "100% within 7 days",
        calculationType: "PERCENTAGE",
        value: 100,
        dueRule: "DAYS_AFTER_INVOICE",
        days: 7,
      },
    ],
  },
  {
    code: "NET15",
    name: "Net 15",
    description: "Full payment due within 15 days",
    termType: "NET_DAYS",
    isSystem: true,
    applicableTo: "all",
    rules: [
      {
        sequence: 1,
        description: "100% within 15 days",
        calculationType: "PERCENTAGE",
        value: 100,
        dueRule: "DAYS_AFTER_INVOICE",
        days: 15,
      },
    ],
  },
  {
    code: "NET30",
    name: "Net 30",
    description: "Full payment due within 30 days",
    termType: "NET_DAYS",
    isSystem: true,
    applicableTo: "all",
    isDefault: true,
    rules: [
      {
        sequence: 1,
        description: "100% within 30 days",
        calculationType: "PERCENTAGE",
        value: 100,
        dueRule: "DAYS_AFTER_INVOICE",
        days: 30,
      },
    ],
  },
  {
    code: "NET45",
    name: "Net 45",
    description: "Full payment due within 45 days",
    termType: "NET_DAYS",
    isSystem: true,
    applicableTo: "all",
    rules: [
      {
        sequence: 1,
        description: "100% within 45 days",
        calculationType: "PERCENTAGE",
        value: 100,
        dueRule: "DAYS_AFTER_INVOICE",
        days: 45,
      },
    ],
  },
  {
    code: "NET60",
    name: "Net 60",
    description: "Full payment due within 60 days",
    termType: "NET_DAYS",
    isSystem: true,
    applicableTo: "all",
    rules: [
      {
        sequence: 1,
        description: "100% within 60 days",
        calculationType: "PERCENTAGE",
        value: 100,
        dueRule: "DAYS_AFTER_INVOICE",
        days: 60,
      },
    ],
  },
  {
    code: "EOM",
    name: "End of Month",
    description: "Payment due by the end of the issue month",
    termType: "END_OF_MONTH",
    isSystem: true,
    applicableTo: "all",
    rules: [
      {
        sequence: 1,
        description: "100% End of Month",
        calculationType: "PERCENTAGE",
        value: 100,
        dueRule: "END_OF_MONTH",
        days: 0,
      },
    ],
  },
  {
    code: "15TH_NEXT_MONTH",
    name: "15th of Next Month",
    description: "Payment due on the 15th of the following month",
    termType: "FIXED_DAY_NEXT_MONTH",
    isSystem: true,
    applicableTo: "all",
    rules: [
      {
        sequence: 1,
        description: "100% on 15th of next month",
        calculationType: "PERCENTAGE",
        value: 100,
        dueRule: "FIXED_DAY_NEXT_MONTH",
        fixedDay: 15,
      },
    ],
  },
];

/**
 * Idempotently seed standard system payment terms for a tenant
 */
export const seedDefaultPaymentTerms = async (tenantId, { session = null } = {}) => {
  if (!tenantId) return [];
  const ops = STANDARD_TERMS_SEED.map((item) => ({
    updateOne: {
      filter: { tenantId, code: item.code },
      update: {
        $setOnInsert: {
          ...item,
          tenantId,
          isActive: true,
        },
      },
      upsert: true,
    },
  }));

  await PaymentTerm.bulkWrite(ops, { session });
  return STANDARD_TERMS_SEED.map((item) => ({
    ...item,
    tenantId,
    isActive: true,
  }));
};

/**
 * Calculate due date deterministically given base date and rule configuration
 */
export const calculateDueDate = ({
  baseDate = new Date(),
  dueRule = "DAYS_AFTER_INVOICE",
  days = 0,
  fixedDay = null,
  fixedDate = null,
  deliveryDate = null,
  milestoneDate = null,
}) => {
  const base = new Date(baseDate);
  if (Number.isNaN(base.getTime())) return null;

  switch (dueRule) {
    case "IMMEDIATE": {
      return new Date(base.getTime());
    }

    case "DAYS_AFTER_INVOICE":
    case "DAYS_AFTER_BILL": {
      const offsetDays = Number(days) || 0;
      return new Date(base.getTime() + offsetDays * DAY_MS);
    }

    case "DAYS_AFTER_DELIVERY": {
      if (!deliveryDate) return null;
      const del = new Date(deliveryDate);
      if (Number.isNaN(del.getTime())) return null;
      const offsetDays = Number(days) || 0;
      return new Date(del.getTime() + offsetDays * DAY_MS);
    }

    case "END_OF_MONTH": {
      const year = base.getFullYear();
      const month = base.getMonth();
      // Month + 1, day 0 gives the last day of the current month
      const lastDayDate = new Date(year, month + 1, 0, 12, 0, 0);
      const offsetDays = Number(days) || 0;
      return new Date(lastDayDate.getTime() + offsetDays * DAY_MS);
    }

    case "FIXED_DAY_NEXT_MONTH": {
      let targetMonth = base.getMonth() + 1;
      let targetYear = base.getFullYear();
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
      // Determine max days in next month to avoid overflow
      const maxDaysNextMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const requestedDay = Number(fixedDay) || 15;
      const clampedDay = Math.min(Math.max(requestedDay, 1), maxDaysNextMonth);
      return new Date(targetYear, targetMonth, clampedDay, 12, 0, 0);
    }

    case "FIXED_DATE": {
      if (!fixedDate) return null;
      const parsed = new Date(fixedDate);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    case "MILESTONE": {
      if (!milestoneDate) return null;
      const ms = new Date(milestoneDate);
      if (Number.isNaN(ms.getTime())) return null;
      const offsetDays = Number(days) || 0;
      return new Date(ms.getTime() + offsetDays * DAY_MS);
    }

    default: {
      return new Date(base.getTime() + (Number(days) || 0) * DAY_MS);
    }
  }
};

/**
 * Validate payment term rules for completeness, positive values, and 100% total
 */
export const validatePaymentTermRules = (rules = []) => {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw Object.assign(new Error("At least one payment term rule is required."), {
      statusCode: 400,
      code: "INVALID_PAYMENT_TERM_RULES",
    });
  }

  let totalPercentage = 0;
  let hasRemainingBalance = false;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule.calculationType || !CALCULATION_TYPES.includes(rule.calculationType)) {
      throw Object.assign(
        new Error(`Rule ${i + 1}: Invalid calculation type '${rule.calculationType}'.`),
        { statusCode: 400, code: "INVALID_PAYMENT_TERM_RULES" }
      );
    }

    if (!rule.dueRule || !DUE_RULES.includes(rule.dueRule)) {
      throw Object.assign(
        new Error(`Rule ${i + 1}: Invalid due rule '${rule.dueRule}'.`),
        { statusCode: 400, code: "INVALID_PAYMENT_TERM_RULES" }
      );
    }

    if (rule.calculationType === "PERCENTAGE") {
      const pct = Number(rule.value || 0);
      if (pct <= 0) {
        throw Object.assign(
          new Error(`Rule ${i + 1}: Percentage value must be greater than 0.`),
          { statusCode: 400, code: "INVALID_PAYMENT_TERM_RULES" }
        );
      }
      totalPercentage = roundMoney(totalPercentage + pct);
    } else if (rule.calculationType === "FIXED_AMOUNT") {
      const amt = Number(rule.value || 0);
      if (amt <= 0) {
        throw Object.assign(
          new Error(`Rule ${i + 1}: Fixed amount must be greater than 0.`),
          { statusCode: 400, code: "INVALID_PAYMENT_TERM_RULES" }
        );
      }
    } else if (rule.calculationType === "REMAINING_BALANCE") {
      if (hasRemainingBalance) {
        throw Object.assign(
          new Error("Only one REMAINING_BALANCE rule is allowed per payment term."),
          { statusCode: 400, code: "INVALID_PAYMENT_TERM_RULES" }
        );
      }
      hasRemainingBalance = true;
    }
  }

  if (!hasRemainingBalance) {
    // If all rules are percentage-based, they must equal 100%
    const isAllPercentage = rules.every((r) => r.calculationType === "PERCENTAGE");
    if (isAllPercentage && Math.abs(totalPercentage - 100) > 0.01) {
      throw Object.assign(
        new Error(`Total percentage of rules must equal 100%. Current total: ${totalPercentage}%.`),
        { statusCode: 400, code: "PAYMENT_TERM_PERCENTAGE_INVALID" }
      );
    }
  }

  return true;
};

/**
 * Generate a payment schedule given document details and selected payment term or custom schedule
 */
export const generatePaymentSchedule = ({
  documentType = "SalesInvoice",
  documentDate = new Date(),
  baseDate = null,
  documentTotal = 0,
  totalAmount = null,
  paymentTerm = null,
  rules = null,
  customSchedule = null,
  deliveryDate = null,
  milestones = {},
}) => {
  const total = roundMoney(totalAmount !== null && totalAmount !== undefined ? totalAmount : documentTotal);
  const docDate = baseDate !== null && baseDate !== undefined ? baseDate : documentDate;
  const effectiveTerm = paymentTerm || (rules ? { rules } : null);
  if (total < 0) {
    throw Object.assign(new Error("Document total cannot be negative."), {
      statusCode: 400,
      code: "INVALID_DOCUMENT_TOTAL",
    });
  }

  // 1. If transaction-specific custom schedule is supplied
  if (Array.isArray(customSchedule) && customSchedule.length > 0) {
    let sumScheduled = 0;
    const lines = [];

    for (let i = 0; i < customSchedule.length; i++) {
      const item = customSchedule[i];
      let lineAmount = 0;

      if (item.amount !== undefined && item.amount !== null && item.amount !== "") {
        lineAmount = roundMoney(item.amount);
      } else if (item.percentage !== undefined && item.percentage !== null) {
        lineAmount = roundMoney((total * Number(item.percentage)) / 100);
      }

      if (lineAmount < 0) {
        throw Object.assign(new Error(`Schedule line ${i + 1}: Amount cannot be negative.`), {
          statusCode: 400,
          code: "PAYMENT_SCHEDULE_TOTAL_MISMATCH",
        });
      }

      const dueDate = item.dueDate ? new Date(item.dueDate) : calculateDueDate({
        baseDate: documentDate,
        dueRule: item.dueRule || "DAYS_AFTER_INVOICE",
        days: item.days || 0,
        fixedDay: item.fixedDay,
        fixedDate: item.fixedDate,
        deliveryDate,
      });

      lines.push({
        sequence: i + 1,
        description: clean(item.description) || `Installment ${i + 1}`,
        dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
        originalAmount: lineAmount,
        paidAmount: 0,
        creditedAmount: 0,
        debitedAmount: 0,
        adjustedAmount: 0,
        outstandingAmount: lineAmount,
        status: dueDate ? "PENDING" : "PENDING_TRIGGER",
        sourceRule: item,
      });

      sumScheduled = roundMoney(sumScheduled + lineAmount);
    }

    if (Math.abs(sumScheduled - total) > 0.05) {
      throw Object.assign(
        new Error(`Custom payment schedule total (${sumScheduled}) must equal document total (${total}).`),
        { statusCode: 400, code: "PAYMENT_SCHEDULE_TOTAL_MISMATCH" }
      );
    }

    // Absorb rounding difference into final line
    const roundingDiff = roundMoney(total - sumScheduled);
    if (lines.length > 0 && Math.abs(roundingDiff) > 0) {
      const lastLine = lines[lines.length - 1];
      lastLine.originalAmount = roundMoney(lastLine.originalAmount + roundingDiff);
      lastLine.outstandingAmount = lastLine.originalAmount;
    }

    const dueDates = lines.map((l) => l.dueDate).filter(Boolean);
    const finalDueDate = dueDates.length
      ? new Date(Math.max(...dueDates.map((d) => d.getTime())))
      : null;

    return { paymentSchedule: lines, schedule: lines, finalDueDate };
  }

  // 2. If PaymentTerm master is provided
  if (effectiveTerm && Array.isArray(effectiveTerm.rules) && effectiveTerm.rules.length > 0) {
    validatePaymentTermRules(effectiveTerm.rules);

    let sumAllocated = 0;
    const lines = [];

    for (let i = 0; i < effectiveTerm.rules.length; i++) {
      const rule = effectiveTerm.rules[i];
      let lineAmount = 0;

      if (rule.calculationType === "PERCENTAGE") {
        lineAmount = roundMoney((total * Number(rule.value || 0)) / 100);
      } else if (rule.calculationType === "FIXED_AMOUNT") {
        lineAmount = Math.min(roundMoney(rule.value || 0), total);
      } else if (rule.calculationType === "REMAINING_BALANCE") {
        lineAmount = Math.max(roundMoney(total - sumAllocated), 0);
      }

      const dueDate = calculateDueDate({
        baseDate: docDate,
        dueRule: rule.dueRule,
        days: rule.days || 0,
        fixedDay: rule.fixedDay,
        fixedDate: rule.fixedDate,
        deliveryDate,
        milestoneDate: milestones[rule.milestoneType] || null,
      });

      lines.push({
        sequence: i + 1,
        description: clean(rule.description) || `${effectiveTerm.name || "Term"} - Installment ${i + 1}`,
        dueDate,
        originalAmount: lineAmount,
        paidAmount: 0,
        creditedAmount: 0,
        debitedAmount: 0,
        adjustedAmount: 0,
        outstandingAmount: lineAmount,
        status: dueDate ? "PENDING" : "PENDING_TRIGGER",
        sourceRule: {
          sequence: rule.sequence,
          calculationType: rule.calculationType,
          value: rule.value,
          dueRule: rule.dueRule,
          days: rule.days,
        },
        milestoneType: rule.milestoneType || "",
      });

      sumAllocated = roundMoney(sumAllocated + lineAmount);
    }

    // Absorb decimal rounding difference into the last installment
    const roundingDiff = roundMoney(total - sumAllocated);
    if (lines.length > 0 && Math.abs(roundingDiff) > 0) {
      const lastLine = lines[lines.length - 1];
      lastLine.originalAmount = roundMoney(lastLine.originalAmount + roundingDiff);
      lastLine.outstandingAmount = lastLine.originalAmount;
    }

    const validDueDates = lines.map((l) => l.dueDate).filter(Boolean);
    const finalDueDate = validDueDates.length
      ? new Date(Math.max(...validDueDates.map((d) => d.getTime())))
      : null;

    return { paymentSchedule: lines, schedule: lines, finalDueDate };
  }

  // 3. Fallback: single installment for full total
  const defaultDueDate = new Date(docDate);
  const fallbackSchedule = [
    {
      sequence: 1,
      description: "Full Payment",
      dueDate: defaultDueDate,
      originalAmount: total,
      paidAmount: 0,
      creditedAmount: 0,
      debitedAmount: 0,
      adjustedAmount: 0,
      outstandingAmount: total,
      status: "PENDING",
      sourceRule: null,
    },
  ];

  return { paymentSchedule: fallbackSchedule, schedule: fallbackSchedule, finalDueDate: defaultDueDate };
};

/**
 * Resolve effective payment term for a transaction following deterministic resolution order:
 * 1. Transaction-specific term
 * 2. Customer / Supplier default term
 * 3. Company default term
 * 4. Fallback system term
 */
export const resolveEffectivePaymentTerm = async ({
  tenantId,
  transactionTermId = null,
  paymentTermId = null,
  customerId = null,
  supplierId = null,
  side = "sales",
  partyType = null,
  session = null,
}) => {
  const termId = transactionTermId || paymentTermId;
  const effectiveSide =
    partyType === "supplier"
      ? "purchase"
      : partyType === "customer"
      ? "sales"
      : side || "sales";

  let resolved = null;

  // 1. Transaction-level term
  if (termId && isId(termId)) {
    resolved = await PaymentTerm.findOne({
      _id: termId,
      tenantId,
      isActive: true,
    }).session(session);
    if (resolved) {
      resolved.paymentTerm = resolved;
      return resolved;
    }
  }

  // 2. Customer or supplier default
  let partyDefaultTermId = null;
  if (effectiveSide === "sales" && customerId && isId(customerId)) {
    const customer = (Customer.findById ? await Customer.findById(customerId).session(session) : null)
      || (await Customer.findOne({ _id: customerId, tenantId }).session(session));
    if (customer?.defaultPaymentTerm) {
      if (typeof customer.defaultPaymentTerm === "object" && customer.defaultPaymentTerm.rules) {
        resolved = customer.defaultPaymentTerm;
        resolved.paymentTerm = resolved;
        return resolved;
      }
      partyDefaultTermId = customer.defaultPaymentTerm._id || customer.defaultPaymentTerm;
    }
  } else if (effectiveSide === "purchase" && supplierId && isId(supplierId)) {
    const supplier = (Supplier.findById ? await Supplier.findById(supplierId).session(session) : null)
      || (await Supplier.findOne({ _id: supplierId, tenantId }).session(session));
    const supTerm = supplier?.procurement?.defaultPaymentTerm || supplier?.defaultPaymentTerm;
    if (supTerm) {
      if (typeof supTerm === "object" && supTerm.rules) {
        resolved = supTerm;
        resolved.paymentTerm = resolved;
        return resolved;
      }
      partyDefaultTermId = supTerm._id || supTerm;
    }
  }

  if (partyDefaultTermId && isId(partyDefaultTermId)) {
    resolved = await PaymentTerm.findOne({
      _id: partyDefaultTermId,
      tenantId,
      isActive: true,
    }).session(session);
    if (resolved) {
      resolved.paymentTerm = resolved;
      return resolved;
    }
  }

  // 3. Company settings default
  const settings = await AccountingSettings.findOne({ tenantId }).session(session);
  const companyTermId =
    effectiveSide === "sales"
      ? settings?.defaultSalesPaymentTerm
      : settings?.defaultPurchasePaymentTerm;

  if (companyTermId && isId(companyTermId)) {
    resolved = await PaymentTerm.findOne({
      _id: companyTermId,
      tenantId,
      isActive: true,
    }).session(session);
    if (resolved) {
      resolved.paymentTerm = resolved;
      return resolved;
    }
  }

  // 4. Fallback to active system term (prefer NET30 or IMMEDIATE)
  const systemQuery = PaymentTerm.findOne({
    tenantId,
    isActive: true,
    $or: [{ code: "NET30" }, { code: "IMMEDIATE" }, { isSystem: true }],
  });

  if (systemQuery && typeof systemQuery.sort === "function") {
    resolved = await systemQuery.sort({ isDefault: -1, code: 1 }).session(session);
  } else if (systemQuery) {
    resolved = await systemQuery;
  }

  if (!resolved && typeof PaymentTerm.create === "function") {
    resolved = await PaymentTerm.create({
      tenantId,
      code: "NET30",
      name: "Net 30 Days",
      termType: "NET_DAYS",
      isPredefined: true,
      isSystem: true,
      rules: [
        {
          sequence: 1,
          description: "100% due within 30 days",
          calculationType: "PERCENTAGE",
          value: 100,
          dueRule: "DAYS_AFTER_INVOICE",
          days: 30,
        },
      ],
    });
  }

  if (resolved) {
    resolved.paymentTerm = resolved;
  }
  return resolved;
};

/**
 * Allocate payment against payment schedule lines (default FIFO oldest due first, or explicit sequence)
 */
export const allocatePaymentToSchedule = (
  schedule = [],
  paymentAmountOrOptions = 0,
  explicitLineSequence = null
) => {
  let paymentAmount = paymentAmountOrOptions;
  let lineSeq = explicitLineSequence;
  if (typeof paymentAmountOrOptions === "object" && paymentAmountOrOptions !== null) {
    paymentAmount = paymentAmountOrOptions.paymentAmount ?? paymentAmountOrOptions.amount ?? 0;
    lineSeq = paymentAmountOrOptions.explicitLineSequence ?? paymentAmountOrOptions.installmentSequence ?? lineSeq;
  }

  let remainingToAllocate = roundMoney(paymentAmount);
  if (remainingToAllocate <= 0 || !Array.isArray(schedule) || schedule.length === 0) {
    return { schedule, allocatedAmount: 0, unallocatedAmount: remainingToAllocate };
  }

  // 1. Explicit line allocation if requested
  if (lineSeq) {
    const targetLine = schedule.find((line) => line.sequence === Number(lineSeq));
    if (targetLine && targetLine.outstandingAmount > 0) {
      const alloc = Math.min(targetLine.outstandingAmount, remainingToAllocate);
      targetLine.paidAmount = roundMoney(targetLine.paidAmount + alloc);
      targetLine.outstandingAmount = roundMoney(
        Math.max(
          targetLine.originalAmount +
            Number(targetLine.debitedAmount || 0) -
            Number(targetLine.creditedAmount || 0) -
            targetLine.paidAmount,
          0
        )
      );
      targetLine.status = targetLine.outstandingAmount === 0 ? "PAID" : "PARTIALLY_PAID";
      remainingToAllocate = roundMoney(remainingToAllocate - alloc);
    }
  }

  // 2. FIFO allocation across remaining unpaid lines (oldest dueDate first)
  if (remainingToAllocate > 0) {
    const eligibleLines = schedule
      .filter((line) => line.outstandingAmount > 0 && line.status !== "CANCELLED")
      .sort((a, b) => {
        const timeA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const timeB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return timeA - timeB || a.sequence - b.sequence;
      });

    for (const line of eligibleLines) {
      if (remainingToAllocate <= 0) break;
      const alloc = Math.min(line.outstandingAmount, remainingToAllocate);
      line.paidAmount = roundMoney(line.paidAmount + alloc);
      line.outstandingAmount = roundMoney(
        Math.max(
          line.originalAmount +
            Number(line.debitedAmount || 0) -
            Number(line.creditedAmount || 0) -
            line.paidAmount,
          0
        )
      );
      line.status = line.outstandingAmount === 0 ? "PAID" : "PARTIALLY_PAID";
      remainingToAllocate = roundMoney(remainingToAllocate - alloc);
    }
  }

  const allocatedAmount = roundMoney(paymentAmount - remainingToAllocate);
  return { schedule, allocatedAmount, unallocatedAmount: remainingToAllocate };
};

/**
 * Reverse a payment from schedule lines (reverse chronological order - LIFO on paid lines)
 */
export const reversePaymentFromSchedule = (
  schedule = [],
  paymentAmountOrOptions = 0,
  explicitLineSequence = null
) => {
  let paymentAmount = paymentAmountOrOptions;
  let lineSeq = explicitLineSequence;
  if (typeof paymentAmountOrOptions === "object" && paymentAmountOrOptions !== null) {
    paymentAmount = paymentAmountOrOptions.paymentAmount ?? paymentAmountOrOptions.amount ?? 0;
    lineSeq = paymentAmountOrOptions.explicitLineSequence ?? paymentAmountOrOptions.installmentSequence ?? lineSeq;
  }

  let remainingToReverse = roundMoney(paymentAmount);
  if (remainingToReverse <= 0 || !Array.isArray(schedule) || schedule.length === 0) {
    return { schedule, reversedAmount: 0 };
  }

  if (lineSeq) {
    const targetLine = schedule.find((line) => line.sequence === Number(lineSeq));
    if (targetLine && targetLine.paidAmount > 0) {
      const rev = Math.min(targetLine.paidAmount, remainingToReverse);
      targetLine.paidAmount = roundMoney(targetLine.paidAmount - rev);
      targetLine.outstandingAmount = roundMoney(
        Math.max(
          targetLine.originalAmount +
            Number(targetLine.debitedAmount || 0) -
            Number(targetLine.creditedAmount || 0) -
            targetLine.paidAmount,
          0
        )
      );
      targetLine.status =
        targetLine.outstandingAmount > 0
          ? targetLine.paidAmount > 0
            ? "PARTIALLY_PAID"
            : "PENDING"
          : "PAID";
      remainingToReverse = roundMoney(remainingToReverse - rev);
    }
  }

  if (remainingToReverse > 0) {
    // Reverse from newest paid lines first (LIFO)
    const paidLines = schedule
      .filter((line) => line.paidAmount > 0)
      .sort((a, b) => {
        const timeA = a.dueDate ? new Date(a.dueDate).getTime() : -Infinity;
        const timeB = b.dueDate ? new Date(b.dueDate).getTime() : -Infinity;
        return timeB - timeA || b.sequence - a.sequence;
      });

    for (const line of paidLines) {
      if (remainingToReverse <= 0) break;
      const rev = Math.min(line.paidAmount, remainingToReverse);
      line.paidAmount = roundMoney(line.paidAmount - rev);
      line.outstandingAmount = roundMoney(
        Math.max(
          line.originalAmount +
            Number(line.debitedAmount || 0) -
            Number(line.creditedAmount || 0) -
            line.paidAmount,
          0
        )
      );
      line.status =
        line.outstandingAmount > 0
          ? line.paidAmount > 0
            ? "PARTIALLY_PAID"
            : "PENDING"
          : "PAID";
      remainingToReverse = roundMoney(remainingToReverse - rev);
    }
  }

  const reversedAmount = roundMoney(paymentAmount - remainingToReverse);
  return { schedule, reversedAmount };
};

/**
 * Apply a Credit Note or Debit Note adjustment to the Payment Schedule.
 * Credit Note: reduces latest unpaid installments first (LIFO on unpaid), never creating negative installments.
 * Debit Note: appends a new due schedule line with standard terms or updates the schedule.
 */
export const applyAdjustmentToSchedule = (
  schedule = [],
  { adjustmentType = "credit", amount = 0 }
) => {
  let remainingAdj = roundMoney(amount);
  if (remainingAdj <= 0 || !Array.isArray(schedule)) {
    return { schedule, appliedAdjustment: 0 };
  }

  if (adjustmentType === "credit") {
    // Reduce latest unpaid installments first (LIFO on lines with outstandingAmount > 0)
    const unpaidLines = schedule
      .filter((line) => line.outstandingAmount > 0 && line.status !== "CANCELLED")
      .sort((a, b) => {
        const timeA = a.dueDate ? new Date(a.dueDate).getTime() : -Infinity;
        const timeB = b.dueDate ? new Date(b.dueDate).getTime() : -Infinity;
        return timeB - timeA || b.sequence - a.sequence;
      });

    for (const line of unpaidLines) {
      if (remainingAdj <= 0) break;
      const reduction = Math.min(line.outstandingAmount, remainingAdj);
      line.creditedAmount = roundMoney(Number(line.creditedAmount || 0) + reduction);
      line.outstandingAmount = roundMoney(
        Math.max(
          line.originalAmount +
            Number(line.debitedAmount || 0) -
            Number(line.creditedAmount || 0) -
            line.paidAmount,
          0
        )
      );
      line.status =
        line.outstandingAmount === 0
          ? line.paidAmount > 0
            ? "PAID"
            : "CANCELLED"
          : line.paidAmount > 0
            ? "PARTIALLY_PAID"
            : "PENDING";
      remainingAdj = roundMoney(remainingAdj - reduction);
    }
  } else if (adjustmentType === "debit") {
    // Debit Note increases obligation: append a distinct installment line so it can be tracked and aged clearly
    const maxSeq = schedule.reduce((max, l) => Math.max(max, l.sequence || 0), 0);
    const debitDueDate = new Date(Date.now() + 30 * DAY_MS); // Standard 30 days due
    schedule.push({
      sequence: maxSeq + 1,
      description: "Debit Adjustment",
      dueDate: debitDueDate,
      originalAmount: remainingAdj,
      paidAmount: 0,
      creditedAmount: 0,
      debitedAmount: 0,
      adjustedAmount: 0,
      outstandingAmount: remainingAdj,
      status: "PENDING",
      sourceRule: { adjustmentType: "debit", amount: remainingAdj },
    });
    remainingAdj = 0;
  }

  return { schedule, appliedAdjustment: roundMoney(amount - remainingAdj) };
};

/**
 * Reverse a Credit Note or Debit Note adjustment from the Payment Schedule upon note cancellation.
 */
export const reverseAdjustmentFromSchedule = (
  schedule = [],
  { adjustmentType = "credit", amount = 0 }
) => {
  let remainingRev = roundMoney(amount);
  if (remainingRev <= 0 || !Array.isArray(schedule)) {
    return { schedule, reversedAdjustment: 0 };
  }

  if (adjustmentType === "credit") {
    // Restore latest credited installments first (FIFO on creditedAmount > 0)
    const creditedLines = schedule
      .filter((line) => Number(line.creditedAmount || 0) > 0)
      .sort((a, b) => {
        const timeA = a.dueDate ? new Date(a.dueDate).getTime() : -Infinity;
        const timeB = b.dueDate ? new Date(b.dueDate).getTime() : -Infinity;
        return timeA - timeB || a.sequence - b.sequence;
      });

    for (const line of creditedLines) {
      if (remainingRev <= 0) break;
      const restore = Math.min(Number(line.creditedAmount || 0), remainingRev);
      line.creditedAmount = roundMoney(Number(line.creditedAmount || 0) - restore);
      line.outstandingAmount = roundMoney(
        Math.max(
          line.originalAmount +
            Number(line.debitedAmount || 0) -
            Number(line.creditedAmount || 0) -
            line.paidAmount,
          0
        )
      );
      line.status =
        line.outstandingAmount === 0
          ? line.paidAmount > 0
            ? "PAID"
            : "CANCELLED"
          : line.paidAmount > 0
            ? "PARTIALLY_PAID"
            : "PENDING";
      remainingRev = roundMoney(remainingRev - restore);
    }
  } else if (adjustmentType === "debit") {
    // Reverse debit: find debit adjustment line(s) and reduce/cancel them
    const debitLines = schedule
      .filter((line) => line.sourceRule?.adjustmentType === "debit" && line.status !== "CANCELLED")
      .reverse();

    for (const line of debitLines) {
      if (remainingRev <= 0) break;
      const reduce = Math.min(line.outstandingAmount, remainingRev);
      line.outstandingAmount = roundMoney(line.outstandingAmount - reduce);
      line.originalAmount = roundMoney(line.originalAmount - reduce);
      if (line.outstandingAmount <= 0) {
        line.status = "CANCELLED";
      }
      remainingRev = roundMoney(remainingRev - reduce);
    }
  }

  return { schedule, reversedAdjustment: roundMoney(amount - remainingRev) };
};

/**
 * Recalculate and return aging buckets for an invoice/bill given its payment schedule
 */
export const calculateScheduleAging = (schedule = [], asOf = new Date()) => {
  const aging = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 };
  if (!Array.isArray(schedule) || schedule.length === 0) return aging;

  const asOfDate = new Date(asOf);

  for (const line of schedule) {
    const outstanding = Number(line.outstandingAmount || 0);
    if (outstanding <= 0 || line.status === "CANCELLED") continue;

    let bucket = "current";
    if (line.dueDate) {
      const days = Math.floor((asOfDate.getTime() - new Date(line.dueDate).getTime()) / DAY_MS);
      if (days > 90) bucket = "days90plus";
      else if (days > 60) bucket = "days61to90";
      else if (days > 30) bucket = "days31to60";
      else if (days > 0) bucket = "days1to30";
      else bucket = "current";
    }

    aging[bucket] = roundMoney(aging[bucket] + outstanding);
    aging.total = roundMoney(aging.total + outstanding);
  }

  return aging;
};
