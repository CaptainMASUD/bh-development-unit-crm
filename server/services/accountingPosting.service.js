import mongoose from "mongoose";
import Account from "../models/account.model.js";
import AccountingPeriod from "../models/accountingPeriod.model.js";
import AccountingSettings from "../models/accountingSettings.model.js";
import FiscalYear from "../models/fiscalYear.model.js";
import JournalEntry from "../models/journalEntry.model.js";
import { accountingCache } from "../utils/cache.js";
import { nextAccountingNumber } from "./accountingNumbering.service.js";

export const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

export const parsePostingDate = (value, fallback = new Date()) => {
  if ((value === undefined || value === null || value === "") && fallback === null) return null;
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const assertOpenAccountingPeriod = async (date) => {
  const postingDay = new Date(date);
  postingDay.setUTCHours(0, 0, 0, 0);
  const settings = await AccountingSettings.findOne({ key: "company" }).select("lockDate").lean();
  if (settings?.lockDate && postingDay <= settings.lockDate) {
    throw Object.assign(new Error(`Posting is locked through ${new Date(settings.lockDate).toISOString().slice(0, 10)}.`), { statusCode: 409 });
  }
  const period = await AccountingPeriod.findOne({ startDate: { $lte: postingDay }, endDate: { $gte: postingDay } }).lean();
  if (!period && await FiscalYear.exists({})) {
    throw Object.assign(new Error("Posting date is not inside a configured accounting period."), { statusCode: 409 });
  }
  if (period && period.status !== "open") {
    throw Object.assign(new Error(`Accounting period ${period.periodKey} is ${period.status}.`), { statusCode: 409 });
  }
};

export const assertPostableLedgerAccounts = async (lines = []) => {
  const rawIds = lines.map((line) => String(line.account || ""));
  const ids = [...new Set(rawIds.filter(isId))];
  if (ids.length !== new Set(rawIds).size) {
    throw Object.assign(new Error("Every journal line must reference a valid account."), { statusCode: 400 });
  }
  const accounts = await Account.find({ _id: { $in: ids } }).select("name code type isActive isGroup publishedAt").lean();
  if (accounts.length !== ids.length) throw Object.assign(new Error("One or more journal accounts do not exist."), { statusCode: 400 });
  const childParents = await Account.distinct("parent", { parent: { $in: ids }, isActive: true });
  const childSet = new Set(childParents.map(String));
  const publishedRequired = Boolean(await AccountingSettings.exists({ key: "company", coaPublishedAt: { $ne: null } }));
  const invalid = accounts.find((account) => !account.isActive || account.isGroup || childSet.has(String(account._id)) || (publishedRequired && !account.publishedAt));
  if (invalid) throw Object.assign(new Error(`Account ${invalid.code} - ${invalid.name} is not an active, published leaf account.`), { statusCode: 400 });
  return new Map(accounts.map((account) => [String(account._id), account]));
};

export const resolveAccountingAccount = async (settingsField, fallbackCode) => {
  const settings = await AccountingSettings.findOne({ key: "company" }).select(settingsField).lean();
  const configured = settings?.[settingsField];
  if (configured) {
    const account = await Account.findOne({ _id: configured, isActive: true, isGroup: { $ne: true } }).lean();
    if (account) return account;
  }
  const account = await Account.findOne({ code: String(fallbackCode), isActive: true, isGroup: { $ne: true } }).lean();
  if (!account) throw Object.assign(new Error(`Missing accounting account ${fallbackCode}. Configure Accounting Settings or bootstrap the Chart of Accounts.`), { statusCode: 409 });
  return account;
};

export const createPostedJournal = async ({ date, lines, sourceType, sourceId = null, reference = "", memo = "", currency = "BDT", userId = null, session = null }) => {
  const postingDate = parsePostingDate(date);
  if (!postingDate) throw Object.assign(new Error("Valid posting date is required."), { statusCode: 400 });
  await assertOpenAccountingPeriod(postingDate);
  await assertPostableLedgerAccounts(lines);
  const entryNo = await nextAccountingNumber("journal", postingDate);
  const payload = {
    entryNo,
    date: postingDate,
    status: "posted",
    sourceType,
    sourceId: isId(sourceId) ? sourceId : null,
    reference: clean(reference),
    memo: clean(memo),
    currency: clean(currency || "BDT").toUpperCase(),
    lines: lines.map((line) => ({
      account: line.account,
      debit: roundMoney(line.debit),
      credit: roundMoney(line.credit),
      description: clean(line.description),
      contactType: clean(line.contactType),
      contactId: isId(line.contactId) ? line.contactId : null,
    })),
    createdBy: userId,
    postedBy: userId,
    postedAt: new Date(),
  };
  const [entry] = await JournalEntry.create([payload], session ? { session } : undefined);
  accountingCache.flushAll();
  return entry;
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
