import mongoose from "mongoose";
import Account from "../../models/account.model.js";
import AccountingPeriod from "../../models/accountingPeriod.model.js";
import AccountingSettings from "../../models/accountingSettings.model.js";
import FiscalYear from "../../models/fiscalYear.model.js";
import JournalEntry from "../../models/journalEntry.model.js";
import VoucherType from "../../models/voucherType.model.js";
import { accountingCache } from "../../utils/cache.js";
import { nextAccountingNumber } from "../../services/accountingNumbering.service.js";
import { provisionSystemAccounts } from "../../services/accountingSetup.service.js";

export const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const VOUCHER_TYPES = ["journal", "payment", "receipt", "contra", "opening", "closing", "sales", "purchase", "payroll", "tax", "adjustment"];

export const voucherTypeForSource = (sourceType = "manual", requested = "") => {
  const value = clean(requested).toLowerCase();
  if (VOUCHER_TYPES.includes(value)) return value;
  return ({
    opening_balance: "opening",
    opening_stock: "opening",
    fiscal_closing: "closing",
    invoice: "sales",
    sales_delivery: "sales",
    sales_return: "sales",
    customer_payment: "receipt",
    vendor_bill: "purchase",
    vendor_payment: "payment",
    expense: "payment",
    bank_transfer: "contra",
    payroll: "payroll",
    tax: "tax",
    goods_receipt: "purchase",
    purchase_return: "purchase",
    lc_margin: "contra",
    lc_charge: "payment",
    lc_settlement: "payment",
    landed_cost: "purchase",
    inventory_adjustment: "adjustment",
    inventory_consumption: "adjustment",
    inventory_loss: "adjustment",
    inventory_transfer: "adjustment",
    inventory_revaluation: "adjustment",
    manual: "journal",
  })[clean(sourceType).toLowerCase()] || "adjustment";
};

export const parsePostingDate = (value, fallback = new Date()) => {
  if ((value === undefined || value === null || value === "") && fallback === null) return null;
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? null : date;
};

import {
  assertAccountingPeriodOpen,
  validatePostingDate,
  assertTransactionMutationAllowed,
  getPeriodForDate,
  getFiscalYearForDate,
} from "./accountingPeriod.service.js";
import { validatePostingDimensions } from "./accountingDimension.service.js";

export {
  assertAccountingPeriodOpen,
  validatePostingDate,
  assertTransactionMutationAllowed,
  getPeriodForDate,
  getFiscalYearForDate,
  validatePostingDimensions,
};

export const assertOpenAccountingPeriod = async (date, session = null, tenantId = null, options = {}) => {
  return assertAccountingPeriodOpen(date, { session, tenantId, ...options });
};

export const assertPostableLedgerAccounts = async (lines = [], session = null) => {
  const rawIds = lines.map((line) => String(line.account || ""));
  const ids = [...new Set(rawIds.filter(isId))];
  if (ids.length !== new Set(rawIds).size) {
    throw Object.assign(new Error("Every journal line must reference a valid account."), { statusCode: 400 });
  }
  const accountsQuery = Account.find({ _id: { $in: ids } }).select("name code type isActive isGroup publishedAt");
  if (session) accountsQuery.session(session);
  const accounts = await accountsQuery.lean();
  if (accounts.length !== ids.length) throw Object.assign(new Error("One or more journal accounts do not exist."), { statusCode: 400 });
  const childQuery = Account.distinct("parent", { parent: { $in: ids }, isActive: true });
  if (session) childQuery.session(session);
  const childParents = await childQuery;
  const childSet = new Set(childParents.map(String));
  const publishedQuery = AccountingSettings.exists({ key: "company", coaPublishedAt: { $ne: null } });
  if (session) publishedQuery.session(session);
  const publishedRequired = Boolean(await publishedQuery);
  const invalid = accounts.find((account) => !account.isActive || account.isGroup || childSet.has(String(account._id)) || (publishedRequired && !account.publishedAt));
  if (invalid) throw Object.assign(new Error(`Account ${invalid.code} - ${invalid.name} is not an active, published leaf account.`), { statusCode: 400 });
  return new Map(accounts.map((account) => [String(account._id), account]));
};

export const resolveAccountingAccount = async (arg1, arg2 = null, sessionArg = null) => {
  let tenantId = null;
  let settingsField = "";
  let fallbackCode = "";
  let session = sessionArg;

  if (typeof arg1 === "object" && arg1 !== null && !Array.isArray(arg1)) {
    tenantId = arg1.tenantId || null;
    settingsField = arg1.settingsField || "";
    fallbackCode = arg1.fallbackCode || "";
    session = arg1.session !== undefined ? arg1.session : sessionArg;
  } else {
    settingsField = arg1;
    fallbackCode = arg2;
  }

  if (tenantId && settingsField) {
    const tenantSettingsQuery = AccountingSettings.findOne({ tenantId }).select(settingsField);
    if (session) tenantSettingsQuery.session(session);
    const tenantSettings = await tenantSettingsQuery.lean();
    const configured = tenantSettings?.[settingsField];
    if (configured) {
      const accountQuery = Account.findOne({ _id: configured, isActive: true, isGroup: { $ne: true } });
      if (session) accountQuery.session(session);
      const account = await accountQuery.lean();
      if (account) return account;
    }
  }

  if (settingsField) {
    const settingsQuery = AccountingSettings.findOne({ key: "company" }).select(settingsField);
    if (session) settingsQuery.session(session);
    const settings = await settingsQuery.lean();
    const configured = settings?.[settingsField];
    if (configured) {
      const accountQuery = Account.findOne({ _id: configured, isActive: true, isGroup: { $ne: true } });
      if (session) accountQuery.session(session);
      const account = await accountQuery.lean();
      if (account) return account;
    }
  }

  if (fallbackCode) {
    let accountQuery = Account.findOne({ code: String(fallbackCode), isActive: true, isGroup: { $ne: true } });
    if (session) accountQuery.session(session);
    let account = await accountQuery.lean();
    if (!account) {
      await provisionSystemAccounts();
      accountQuery = Account.findOne({ code: String(fallbackCode), isActive: true, isGroup: { $ne: true } });
      if (session) accountQuery.session(session);
      account = await accountQuery.lean();
    }
    if (account) return account;
  }

  throw Object.assign(
    new Error(`Missing accounting account for '${settingsField || fallbackCode}'. Configure Accounting Settings or bootstrap Chart of Accounts.`),
    { statusCode: 409 }
  );
};

export const createPostedJournal = async ({
  tenantId = null,
  inventoryMovement = null,
  date,
  lines,
  sourceType,
  sourceId = null,
  reference = "",
  memo = "",
  currency = "BDT",
  voucherType = "",
  paymentMode = "",
  treasuryAccountType = "",
  cashAccount = null,
  bankAccount = null,
  origin = "system",
  userId = null,
  user = null,
  overrideReason = "",
  allowClosedPeriod = false,
  session = null,
}) => {
  const postingDate = parsePostingDate(date);
  if (!postingDate) throw Object.assign(new Error("Valid posting date is required."), { statusCode: 400 });
  await assertAccountingPeriodOpen(postingDate, {
    session,
    tenantId,
    user: user || (userId ? { _id: userId } : null),
    overrideReason,
    allowClosedPeriod,
  });
  await assertPostableLedgerAccounts(lines, session);
  const validatedLines = await validatePostingDimensions({ lines, tenantId, session });
  const periodQuery = AccountingPeriod.findOne({ startDate: { $lte: postingDate }, endDate: { $gte: postingDate } }).select("_id fiscalYearRef");
  if (session) periodQuery.session(session);
  const period = await periodQuery.lean();
  const fiscalYearQuery = FiscalYear.findOne({ startDate: { $lte: postingDate }, endDate: { $gte: postingDate } }).select("_id");
  if (session) fiscalYearQuery.session(session);
  const fiscalYear = period?.fiscalYearRef || (await fiscalYearQuery.lean())?._id || null;
  const resolvedVoucherType = voucherTypeForSource(sourceType, voucherType);
  const voucherQuery = VoucherType.findOne({ key: resolvedVoucherType, isActive: true }).select("numberingRule");
  if (session) voucherQuery.session(session);
  const numberingRule = (await voucherQuery.lean())?.numberingRule || (resolvedVoucherType === "journal" ? "journal" : "voucher");
  const entryNo = await nextAccountingNumber(numberingRule, postingDate);
  const payload = {
    tenantId: isId(tenantId) ? tenantId : null,
    inventoryMovement: isId(inventoryMovement) ? inventoryMovement : null,
    entryNo,
    date: postingDate,
    status: "posted",
    sourceType,
    voucherType: resolvedVoucherType,
    origin: origin === "manual" ? "manual" : "system",
    fiscalYear,
    accountingPeriod: period?._id || null,
    sourceId: isId(sourceId) ? sourceId : null,
    reference: clean(reference),
    memo: clean(memo),
    currency: clean(currency || "BDT").toUpperCase(),
    paymentMode: clean(paymentMode).toLowerCase(),
    treasuryAccountType: ["cash", "bank"].includes(clean(treasuryAccountType).toLowerCase())
      ? clean(treasuryAccountType).toLowerCase()
      : "",
    cashAccount: isId(cashAccount) ? cashAccount : null,
    bankAccount: isId(bankAccount) ? bankAccount : null,
    lines: validatedLines.map((line) => ({
      account: line.account,
      debit: roundMoney(line.debit),
      credit: roundMoney(line.credit),
      description: clean(line.description),
      contactType: clean(line.contactType),
      contactId: isId(line.contactId) ? line.contactId : null,
      costCenter: isId(line.costCenter) ? line.costCenter : null,
      project: isId(line.project) ? line.project : null,
      branch: isId(line.branch) ? line.branch : null,
      department: isId(line.department) ? line.department : null,
      dimensions: line.dimensions || new Map(),
      taxCode: clean(line.taxCode).toUpperCase(),
    })),
    createdBy: userId,
    postedBy: userId,
    postedAt: new Date(),
  };
  const [entry] = await JournalEntry.create([payload], session ? { session } : undefined);
  accountingCache.flushAll();
  return entry;
};

export const createReversalJournal = async ({
  originalJournalId,
  date = new Date(),
  reason = "Compensating reversal",
  userId = null,
  user = null,
  overrideReason = "",
  session = null,
}) => {
  const originalQuery = JournalEntry.findById(originalJournalId);
  if (session) originalQuery.session(session);
  const original = await originalQuery;
  if (!original) {
    throw Object.assign(new Error("Original journal entry not found for reversal."), { statusCode: 404 });
  }
  if (original.status !== "posted") {
    throw Object.assign(new Error(`Cannot reverse journal entry in '${original.status}' status.`), { statusCode: 400 });
  }

  const postingDate = parsePostingDate(date);
  if (!postingDate) throw Object.assign(new Error("Valid posting date is required."), { statusCode: 400 });
  await assertAccountingPeriodOpen(postingDate, {
    session,
    tenantId: original.tenantId,
    user: user || (userId ? { _id: userId } : null),
    overrideReason,
  });

  const reversedLines = original.lines.map((l) => ({
    account: l.account?._id || l.account,
    debit: l.credit,
    credit: l.debit,
    description: `Reversal: ${l.description || ""}`.trim(),
    contactType: l.contactType,
    contactId: l.contactId,
    costCenter: l.costCenter,
    project: l.project,
    branch: l.branch,
    department: l.department,
    dimensions: l.dimensions,
    taxCode: l.taxCode,
  }));

  const reversalEntry = await createPostedJournal({
    tenantId: original.tenantId,
    inventoryMovement: original.inventoryMovement,
    date: postingDate,
    lines: reversedLines,
    sourceType: original.sourceType,
    sourceId: original.sourceId,
    reference: `REV-${original.entryNo || original._id}`,
    memo: clean(reason) || `Reversal of ${original.entryNo}`,
    currency: original.currency,
    voucherType: original.voucherType,
    origin: "system",
    userId,
    user,
    overrideReason,
    session,
  });

  original.status = "reversed";
  original.reversedAt = new Date();
  original.reversedBy = userId;
  original.reversedByEntry = reversalEntry._id;
  original.reversalReason = clean(reason);
  await original.save({ session });

  reversalEntry.reversalOf = original._id;
  await reversalEntry.save({ session });

  accountingCache.flushAll();
  return reversalEntry;
};

export const movementLines = ({ bankLedger, counterpartLedger, direction, amount, description = "" }) => {
  const increaseOnDebit = ["asset", "expense"].includes(bankLedger.type);
  const bankDebit = direction === "in" ? increaseOnDebit : !increaseOnDebit;
  return bankDebit
    ? [
        { account: bankLedger._id, debit: amount, credit: 0, description },
        { account: counterpartLedger._id, debit: 0, credit: amount, description },
      ]
    : [
        { account: counterpartLedger._id, debit: amount, credit: 0, description },
        { account: bankLedger._id, debit: 0, credit: amount, description },
      ];
};
