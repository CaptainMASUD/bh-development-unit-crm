import mongoose from "mongoose";
import AccountingPeriod from "../../models/accountingPeriod.model.js";
import AccountingSettings from "../../models/accountingSettings.model.js";
import FiscalYear from "../../models/fiscalYear.model.js";
import JournalEntry from "../../models/journalEntry.model.js";
import CashAccount from "../../models/cashAccount.model.js";
import BankAccount from "../../models/bankAccount.model.js";
import BankReconciliation from "../../models/bankReconciliation.model.js";
import { writeAudit } from "../../utils/audit.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

export const PERIOD_STATES = Object.freeze({
  OPEN: "open",
  SOFT_CLOSED: "soft_closed",
  CLOSED: "closed",
  LOCKED: "locked",
});

export const PERIOD_ERROR_CODES = Object.freeze({
  ACCOUNTING_PERIOD_SOFT_CLOSED: "ACCOUNTING_PERIOD_SOFT_CLOSED",
  ACCOUNTING_PERIOD_CLOSED: "ACCOUNTING_PERIOD_CLOSED",
  ACCOUNTING_PERIOD_LOCKED: "ACCOUNTING_PERIOD_LOCKED",
  NO_ACCOUNTING_PERIOD: "NO_ACCOUNTING_PERIOD",
  FISCAL_YEAR_CLOSED: "FISCAL_YEAR_CLOSED",
  POSTING_DATE_NOT_ALLOWED: "POSTING_DATE_NOT_ALLOWED",
  ACCOUNTING_PERIOD_OVERRIDE_REQUIRED: "ACCOUNTING_PERIOD_OVERRIDE_REQUIRED",
});

const createPeriodError = (code, message, details = {}) => {
  const error = new Error(message);
  error.statusCode = code === PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_SOFT_CLOSED ? 403 : 400;
  error.code = code;
  Object.assign(error, details);
  return error;
};

export const resolveCompanyId = (companyId) => {
  if (!companyId) return null;
  if (mongoose.Types.ObjectId.isValid(companyId)) {
    return new mongoose.Types.ObjectId(String(companyId));
  }
  return String(companyId);
};

export const parsePostingDate = (value, fallback = new Date()) => {
  if ((value === undefined || value === null || value === "") && fallback === null) return null;
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isUserAuthorizedForOverride = (user) => {
  if (!user) return false;
  if (["superadmin", "admin"].includes(user.role)) return true;
  const permissions = user.permissionGroup?.permissions || user.permissions || [];
  return (
    permissions.includes("finance:manage") ||
    permissions.includes("finance:period-override") ||
    permissions.includes("accounting.period.override")
  );
};

export const getPeriodForDate = async ({ date, session = null, tenantId = null }) => {
  const postingDay = new Date(date);
  postingDay.setUTCHours(0, 0, 0, 0);

  const filter = {
    startDate: { $lte: postingDay },
    endDate: { $gte: postingDay },
  };
  if (tenantId) filter.tenantId = tenantId;

  let query = AccountingPeriod.findOne(filter);
  if (session) query.session(session);
  let period = await query.lean();

  if (!period && tenantId) {
    const fallbackQuery = AccountingPeriod.findOne({
      startDate: { $lte: postingDay },
      endDate: { $gte: postingDay },
    });
    if (session) fallbackQuery.session(session);
    period = await fallbackQuery.lean();
  }

  return period;
};

export const getFiscalYearForDate = async ({ date, session = null, tenantId = null }) => {
  const postingDay = new Date(date);
  postingDay.setUTCHours(0, 0, 0, 0);

  const filter = {
    startDate: { $lte: postingDay },
    endDate: { $gte: postingDay },
  };
  if (tenantId) filter.tenantId = tenantId;

  let query = FiscalYear.findOne(filter);
  if (session) query.session(session);
  let fiscalYear = await query.lean();

  if (!fiscalYear && tenantId) {
    const fallbackQuery = FiscalYear.findOne({
      startDate: { $lte: postingDay },
      endDate: { $gte: postingDay },
    });
    if (session) fallbackQuery.session(session);
    fiscalYear = await fallbackQuery.lean();
  }

  return fiscalYear;
};

export const validatePostingDate = async ({
  date,
  session = null,
  tenantId = null,
  user = null,
  overrideReason = "",
  allowClosedPeriod = false,
  action = "posting",
} = {}) => {
  const postingDate = parsePostingDate(date, null);
  if (!postingDate) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.POSTING_DATE_NOT_ALLOWED,
      "Valid posting date is required."
    );
  }

  const postingDay = new Date(postingDate);
  postingDay.setUTCHours(0, 0, 0, 0);

  // 1. Check AccountingSettings lockDate
  const settingsFilter = tenantId ? { tenantId } : { key: "company" };
  let settingsQuery = AccountingSettings.findOne(settingsFilter).select("lockDate");
  if (session) settingsQuery.session(session);
  let settings = await settingsQuery.lean();
  if (!settings && tenantId) {
    const fallbackQuery = AccountingSettings.findOne({ key: "company" }).select("lockDate");
    if (session) fallbackQuery.session(session);
    settings = await fallbackQuery.lean();
  }

  if (settings?.lockDate && postingDay <= new Date(settings.lockDate)) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.POSTING_DATE_NOT_ALLOWED,
      `Posting is locked through ${new Date(settings.lockDate).toISOString().slice(0, 10)}.`,
      { lockDate: settings.lockDate }
    );
  }

  // 2. Check Fiscal Year
  const fyFilter = tenantId ? { tenantId } : {};
  let hasFyQuery = FiscalYear.exists(fyFilter);
  if (session) hasFyQuery.session(session);
  let hasFiscalYear = Boolean(await hasFyQuery);
  if (!hasFiscalYear && tenantId) {
    const globalFyQuery = FiscalYear.exists({});
    if (session) globalFyQuery.session(session);
    hasFiscalYear = Boolean(await globalFyQuery);
  }

  const fiscalYear = await getFiscalYearForDate({ date: postingDay, session, tenantId });

  if (hasFiscalYear && !fiscalYear) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.NO_ACCOUNTING_PERIOD,
      "Posting date is outside any configured fiscal year."
    );
  }

  if (fiscalYear && ["closed", "locked"].includes(fiscalYear.status)) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.FISCAL_YEAR_CLOSED,
      `Fiscal year ${fiscalYear.name} is ${fiscalYear.status}. Posting is not allowed.`,
      { fiscalYear: fiscalYear.name, fiscalYearStatus: fiscalYear.status }
    );
  }

  // 3. Check Accounting Period
  const period = await getPeriodForDate({ date: postingDay, session, tenantId });

  if (!period && hasFiscalYear) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.NO_ACCOUNTING_PERIOD,
      "Posting date is not inside a configured accounting period."
    );
  }

  if (!period) {
    return {
      allowed: true,
      period: null,
      fiscalYear: fiscalYear || null,
      postingDate,
    };
  }

  const status = clean(period.status || PERIOD_STATES.OPEN).toLowerCase();

  if (status === PERIOD_STATES.OPEN) {
    return {
      allowed: true,
      period,
      fiscalYear: period.fiscalYearRef || fiscalYear || null,
      postingDate,
    };
  }

  if (status === PERIOD_STATES.SOFT_CLOSED) {
    const authorized = isUserAuthorizedForOverride(user);
    const cleanOverride = clean(overrideReason);

    if (authorized && cleanOverride) {
      // Record override asynchronously
      void AccountingPeriod.updateOne(
        { _id: period._id },
        {
          $push: {
            overrideLog: {
              user: user?._id || null,
              userName: user?.name || user?.email || "Authorized User",
              reason: cleanOverride,
              postingDate,
              action,
              timestamp: new Date(),
            },
          },
        }
      ).catch(() => {});

      return {
        allowed: true,
        period,
        fiscalYear: period.fiscalYearRef || fiscalYear || null,
        overridden: true,
        overrideReason: cleanOverride,
        postingDate,
      };
    }

    if (authorized && !cleanOverride) {
      throw createPeriodError(
        PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_OVERRIDE_REQUIRED,
        `Accounting period ${period.periodKey} is soft-closed. An explicit override reason is required to post.`,
        { periodKey: period.periodKey, periodId: period._id, status }
      );
    }

    throw createPeriodError(
      PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_SOFT_CLOSED,
      `Accounting period ${period.periodKey} is soft-closed. Normal postings are not permitted.`,
      { periodKey: period.periodKey, periodId: period._id, status }
    );
  }

  if (status === PERIOD_STATES.CLOSED) {
    if (allowClosedPeriod) {
      return {
        allowed: true,
        period,
        fiscalYear: period.fiscalYearRef || fiscalYear || null,
        closedPeriodAllowed: true,
        postingDate,
      };
    }

    throw createPeriodError(
      PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_CLOSED,
      `Accounting period ${period.periodKey} is closed. Financial posting, modification, or backdating is not allowed.`,
      { periodKey: period.periodKey, periodId: period._id, status }
    );
  }

  if (status === PERIOD_STATES.LOCKED) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_LOCKED,
      `Accounting period ${period.periodKey} is locked. Transactions in this period are permanently frozen.`,
      { periodKey: period.periodKey, periodId: period._id, status }
    );
  }

  return { allowed: true, period, fiscalYear: period.fiscalYearRef || fiscalYear || null, postingDate };
};

export const assertAccountingPeriodOpen = async (dateOrOptions, maybeOptions = {}) => {
  if (
    dateOrOptions &&
    typeof dateOrOptions === "object" &&
    !(dateOrOptions instanceof Date) &&
    ("date" in dateOrOptions || "postingDate" in dateOrOptions)
  ) {
    return validatePostingDate({
      ...dateOrOptions,
      date: dateOrOptions.date || dateOrOptions.postingDate,
      ...maybeOptions,
    });
  }
  return validatePostingDate({ date: dateOrOptions, ...maybeOptions });
};

export const assertTransactionMutationAllowed = async ({
  existingDate,
  transactionDate,
  newDate = null,
  session = null,
  tenantId = null,
  companyId = null,
  user = null,
  overrideReason = "",
  action = "modify",
} = {}) => {
  const targetExistingDate = existingDate || transactionDate;
  const effectiveTenantId = tenantId || companyId;
  if (targetExistingDate) {
    const existingPeriod = await getPeriodForDate({ date: targetExistingDate, session, tenantId: effectiveTenantId });
    if (existingPeriod) {
      const status = clean(existingPeriod.status || PERIOD_STATES.OPEN).toLowerCase();

      if (status === PERIOD_STATES.LOCKED) {
        throw createPeriodError(
          PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_LOCKED,
          `Cannot ${action} a transaction in locked accounting period ${existingPeriod.periodKey}. Historical records are permanently locked.`,
          { periodKey: existingPeriod.periodKey, status }
        );
      }

      if (status === PERIOD_STATES.CLOSED) {
        throw createPeriodError(
          PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_CLOSED,
          `Cannot ${action} a transaction in closed accounting period ${existingPeriod.periodKey}. Reopen the period to proceed.`,
          { periodKey: existingPeriod.periodKey, status }
        );
      }

      if (status === PERIOD_STATES.SOFT_CLOSED) {
        const authorized = isUserAuthorizedForOverride(user);
        const cleanOverride = clean(overrideReason);
        if (!authorized || !cleanOverride) {
          throw createPeriodError(
            authorized
              ? PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_OVERRIDE_REQUIRED
              : PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_SOFT_CLOSED,
            `Cannot ${action} a transaction in soft-closed accounting period ${existingPeriod.periodKey} without an authorized override reason.`,
            { periodKey: existingPeriod.periodKey, status }
          );
        }
      }
    }
  }

  if (newDate) {
    await validatePostingDate({
      date: newDate,
      session,
      tenantId,
      user,
      overrideReason,
      action,
    });
  }
};

export const softClosePeriod = async ({ periodKey, tenantId = null, user = null, reason = "", req = null }) => {
  const filter = { periodKey: clean(periodKey) };
  if (tenantId) filter.tenantId = tenantId;

  const current = await AccountingPeriod.findOne(filter);
  if (!current) {
    throw Object.assign(new Error("Accounting period not found."), { statusCode: 404 });
  }
  if (current.status !== PERIOD_STATES.OPEN) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.POSTING_DATE_NOT_ALLOWED,
      `Only open accounting periods can be soft-closed. Current status is ${current.status}.`
    );
  }

  const cleanReason = clean(reason);
  current.status = PERIOD_STATES.SOFT_CLOSED;
  current.softClosedAt = new Date();
  current.softClosedBy = user?._id || null;
  current.softCloseReason = cleanReason;
  await current.save();

  await writeAudit({
    actorId: user?._id,
    action: "status_change",
    entityType: "AccountingPeriod",
    entityId: current._id,
    before: { status: PERIOD_STATES.OPEN },
    after: current.toObject(),
    meta: {
      tenantId,
      periodKey: current.periodKey,
      operation: "soft_close",
      oldStatus: PERIOD_STATES.OPEN,
      newStatus: PERIOD_STATES.SOFT_CLOSED,
      reason: cleanReason,
    },
  });

  return current;
};

export const closePeriod = async ({ periodKey, tenantId = null, user = null, reason = "", req = null }) => {
  const filter = { periodKey: clean(periodKey) };
  if (tenantId) filter.tenantId = tenantId;

  const current = await AccountingPeriod.findOne(filter);
  if (!current) {
    throw Object.assign(new Error("Accounting period not found."), { statusCode: 404 });
  }
  if (![PERIOD_STATES.OPEN, PERIOD_STATES.SOFT_CLOSED].includes(current.status)) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.POSTING_DATE_NOT_ALLOWED,
      `Accounting period is already ${current.status}.`
    );
  }

  // Pre-closing check 1: Unposted draft journals
  const drafts = await JournalEntry.countDocuments({
    status: "draft",
    date: { $gte: current.startDate, $lte: current.endDate },
    ...(tenantId ? { tenantId } : {}),
  });
  if (drafts > 0) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.POSTING_DATE_NOT_ALLOWED,
      `Period has ${drafts} unposted draft journal entr${drafts === 1 ? "y" : "ies"}. Post or void them before closing.`
    );
  }

  // Pre-closing check 2: Check for unbalanced journals
  const unbalanced = await JournalEntry.aggregate([
    {
      $match: {
        status: "posted",
        date: { $gte: current.startDate, $lte: current.endDate },
        ...(tenantId ? { tenantId: new mongoose.Types.ObjectId(String(tenantId)) } : {}),
      },
    },
    { $unwind: "$lines" },
    {
      $group: {
        _id: "$_id",
        entryNo: { $first: "$entryNo" },
        totalDebit: { $sum: "$lines.debit" },
        totalCredit: { $sum: "$lines.credit" },
      },
    },
    {
      $project: {
        entryNo: 1,
        diff: { $abs: { $subtract: ["$totalDebit", "$totalCredit"] } },
      },
    },
    { $match: { diff: { $gt: 0.009 } } },
    { $limit: 1 },
  ]);
  if (unbalanced.length > 0) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.POSTING_DATE_NOT_ALLOWED,
      `Unbalanced journal entry found (${unbalanced[0].entryNo}). Reconcile before closing.`
    );
  }

  // Pre-closing check 3: Bank reconciliations if configured
  const settingsFilter = tenantId ? { tenantId } : { key: "company" };
  const settings = await AccountingSettings.findOne(settingsFilter)
    .select("periodCloseRequireReconciliation")
    .lean();

  if (settings?.periodCloseRequireReconciliation) {
    const [legacyUnreconciled, reconciledBankIds] = await Promise.all([
      CashAccount.countDocuments({
        type: { $in: ["bank", "mobile_banking", "card"] },
        isActive: true,
        ...(tenantId ? { tenantId } : {}),
        $or: [{ lastReconciledAt: null }, { lastReconciledAt: { $lt: current.endDate } }],
      }),
      BankReconciliation.distinct("bankAccount", {
        status: "reconciled",
        statementDate: { $gte: current.endDate },
        ...(tenantId ? { tenantId } : {}),
      }),
    ]);
    const connectedUnreconciled = await BankAccount.countDocuments({
      status: "active",
      _id: { $nin: reconciledBankIds },
      ...(tenantId ? { tenantId } : {}),
    });
    const unreconciled = legacyUnreconciled + connectedUnreconciled;
    if (unreconciled > 0) {
      throw createPeriodError(
        PERIOD_ERROR_CODES.POSTING_DATE_NOT_ALLOWED,
        `${unreconciled} active bank account(s) are not reconciled through period end.`
      );
    }
  }

  const oldStatus = current.status;
  const cleanReason = clean(reason);
  current.status = PERIOD_STATES.CLOSED;
  current.closedAt = new Date();
  current.closedBy = user?._id || null;
  current.closeReason = cleanReason;
  await current.save();

  await writeAudit({
    actorId: user?._id,
    action: "status_change",
    entityType: "AccountingPeriod",
    entityId: current._id,
    before: { status: oldStatus },
    after: current.toObject(),
    meta: {
      tenantId,
      periodKey: current.periodKey,
      operation: "close",
      oldStatus,
      newStatus: PERIOD_STATES.CLOSED,
      reason: cleanReason,
    },
  });

  return current;
};

export const lockPeriod = async ({ periodKey, tenantId = null, user = null, reason = "", req = null }) => {
  const filter = { periodKey: clean(periodKey) };
  if (tenantId) filter.tenantId = tenantId;

  const current = await AccountingPeriod.findOne(filter);
  if (!current) {
    throw Object.assign(new Error("Accounting period not found."), { statusCode: 404 });
  }

  const oldStatus = current.status;
  const cleanReason = clean(reason);
  current.status = PERIOD_STATES.LOCKED;
  current.lockedAt = new Date();
  current.lockedBy = user?._id || null;
  current.lockReason = cleanReason;
  await current.save();

  await writeAudit({
    actorId: user?._id,
    action: "status_change",
    entityType: "AccountingPeriod",
    entityId: current._id,
    before: { status: oldStatus },
    after: current.toObject(),
    meta: {
      tenantId,
      periodKey: current.periodKey,
      operation: "lock",
      oldStatus,
      newStatus: PERIOD_STATES.LOCKED,
      reason: cleanReason,
    },
  });

  return current;
};

export const reopenPeriod = async ({
  periodKey,
  tenantId = null,
  user = null,
  reason = "",
  targetStatus = PERIOD_STATES.OPEN,
  req = null,
}) => {
  const cleanReason = clean(reason);
  if (!cleanReason) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.POSTING_DATE_NOT_ALLOWED,
      "A reason is required to reopen an accounting period."
    );
  }

  const filter = { periodKey: clean(periodKey) };
  if (tenantId) filter.tenantId = tenantId;

  const current = await AccountingPeriod.findOne(filter);
  if (!current) {
    throw Object.assign(new Error("Accounting period not found."), { statusCode: 404 });
  }
  if (current.status === PERIOD_STATES.LOCKED) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_LOCKED,
      "Locked accounting periods cannot be reopened directly. Platform emergency unlock is required."
    );
  }
  if (current.status === PERIOD_STATES.OPEN) {
    return current; // Idempotent
  }

  const oldStatus = current.status;
  current.status = targetStatus === PERIOD_STATES.SOFT_CLOSED ? PERIOD_STATES.SOFT_CLOSED : PERIOD_STATES.OPEN;
  current.reopenedAt = new Date();
  current.reopenedBy = user?._id || null;
  current.reopenReason = cleanReason;
  current.closedAt = null;
  current.closedBy = null;
  current.closeReason = "";
  if (current.status === PERIOD_STATES.OPEN) {
    current.softClosedAt = null;
    current.softClosedBy = null;
    current.softCloseReason = "";
  }
  await current.save();

  await writeAudit({
    actorId: user?._id,
    action: "status_change",
    entityType: "AccountingPeriod",
    entityId: current._id,
    before: { status: oldStatus },
    after: current.toObject(),
    meta: {
      tenantId,
      periodKey: current.periodKey,
      operation: "reopen",
      oldStatus,
      newStatus: current.status,
      reason: cleanReason,
    },
  });

  return current;
};

export const unlockPeriod = async ({ periodKey, tenantId = null, user = null, reason = "", req = null }) => {
  const cleanReason = clean(reason);
  if (!cleanReason) {
    throw createPeriodError(
      PERIOD_ERROR_CODES.POSTING_DATE_NOT_ALLOWED,
      "A reason is required to unlock an accounting period."
    );
  }

  // Only superadmin or tenant admin with emergency authority
  if (!user || !["superadmin", "admin"].includes(user.role)) {
    throw Object.assign(new Error("Unauthorized: administrative unlock authority is required."), {
      statusCode: 403,
    });
  }

  const filter = { periodKey: clean(periodKey) };
  if (tenantId) filter.tenantId = tenantId;

  const current = await AccountingPeriod.findOne(filter);
  if (!current) {
    throw Object.assign(new Error("Accounting period not found."), { statusCode: 404 });
  }
  if (current.status !== PERIOD_STATES.LOCKED) {
    return current; // Idempotent
  }

  const oldStatus = current.status;
  current.status = PERIOD_STATES.OPEN;
  current.unlockedAt = new Date();
  current.unlockedBy = user?._id || null;
  current.unlockReason = cleanReason;
  current.lockedAt = null;
  current.lockedBy = null;
  current.lockReason = "";
  current.closedAt = null;
  current.closedBy = null;
  current.closeReason = "";
  current.softClosedAt = null;
  current.softClosedBy = null;
  current.softCloseReason = "";
  await current.save();

  await writeAudit({
    actorId: user?._id,
    action: "status_change",
    entityType: "AccountingPeriod",
    entityId: current._id,
    before: { status: oldStatus },
    after: current.toObject(),
    meta: {
      tenantId,
      periodKey: current.periodKey,
      operation: "unlock",
      oldStatus,
      newStatus: PERIOD_STATES.OPEN,
      reason: cleanReason,
    },
  });

  return current;
};
