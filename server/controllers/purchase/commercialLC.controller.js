import mongoose from "mongoose";
import CommercialLC, {
  LC_CHARGE_TYPES,
  LC_STATUSES,
  LC_TYPES,
} from "../../models/commercialLC.model.js";
import PurchaseOrder from "../../models/purchaseOrder.model.js";
import Supplier from "../../models/supplier.model.js";
import Bank from "../../models/bank.model.js";
import BankAccount from "../../models/bankAccount.model.js";
import {
  assertImportPurchaseOrder,
  findCommercialLCForUpdate,
  nextImportDocumentNumber,
  updateLCStatus,
  updatePurchaseOrderImportStatus,
} from "../../services/commercialLC.service.js";
import {
  postLCChargeAccounting,
  postLCMarginAccounting,
  postLCSettlementAccounting,
} from "../../services/importAccounting.service.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const sessionOptions = (session) => (session ? { session } : undefined);
const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const editableFields = [
  "issuingBank",
  "bankAccount",
  "beneficiaryBankName",
  "beneficiaryBankSwift",
  "lcType",
  "amount",
  "currency",
  "exchangeRate",
  "marginPercent",
  "marginAmount",
  "applicationDate",
  "openedDate",
  "expiryDate",
  "latestShipmentDate",
  "usanceDays",
  "incoterm",
  "portOfLoading",
  "portOfDischarge",
  "countryOfOrigin",
  "insurancePolicyNo",
  "notes",
];

const buildPatch = (body = {}) => {
  const patch = {};
  for (const field of editableFields) {
    if (body[field] === undefined) continue;
    if (["issuingBank", "bankAccount"].includes(field)) patch[field] = body[field] ? (isId(body[field]) ? body[field] : undefined) : null;
    else if (["amount", "exchangeRate", "marginPercent", "marginAmount", "usanceDays"].includes(field)) patch[field] = Number(body[field]);
    else if (["applicationDate", "openedDate", "expiryDate", "latestShipmentDate"].includes(field)) patch[field] = body[field] ? parseDate(body[field]) : null;
    else patch[field] = clean(body[field]);
  }
  if (patch.currency !== undefined) patch.currency = clean(patch.currency).toUpperCase();
  if (patch.lcType !== undefined) patch.lcType = clean(patch.lcType).toLowerCase();
  if (patch.incoterm !== undefined) patch.incoterm = clean(patch.incoterm).toUpperCase();
  return patch;
};

const validatePatch = (patch, source = {}) => {
  const errors = [];
  if (patch.issuingBank === undefined && patch.issuingBank !== null && Object.prototype.hasOwnProperty.call(patch, "issuingBank")) errors.push("issuingBank must be a valid bank ID.");
  if (patch.bankAccount === undefined && patch.bankAccount !== null && Object.prototype.hasOwnProperty.call(patch, "bankAccount")) errors.push("bankAccount must be a valid bank-account ID.");
  if (patch.lcType !== undefined && !LC_TYPES.includes(patch.lcType)) errors.push("Invalid LC type.");
  if (patch.amount !== undefined && (!Number.isFinite(patch.amount) || patch.amount <= 0)) errors.push("LC amount must be greater than zero.");
  if (patch.exchangeRate !== undefined && (!Number.isFinite(patch.exchangeRate) || patch.exchangeRate <= 0)) errors.push("Exchange rate must be greater than zero.");
  if (patch.marginPercent !== undefined && (!Number.isFinite(patch.marginPercent) || patch.marginPercent < 0 || patch.marginPercent > 100)) errors.push("Margin percentage must be between 0 and 100.");
  if (patch.marginAmount !== undefined && (!Number.isFinite(patch.marginAmount) || patch.marginAmount < 0)) errors.push("Margin amount cannot be negative.");
  if (patch.usanceDays !== undefined && (!Number.isFinite(patch.usanceDays) || patch.usanceDays < 0)) errors.push("Usance days cannot be negative.");
  for (const field of ["applicationDate", "openedDate", "expiryDate", "latestShipmentDate"]) {
    if (Object.prototype.hasOwnProperty.call(source, field) && source[field] && patch[field] === null) {
      errors.push(`${field} must be a valid date.`);
    }
  }
  return errors;
};

const populateLC = (query) =>
  query
    .populate("purchaseOrder", "orderNo orderDate tradeType importStatus status currency exchangeRate incoterm grandTotal")
    .populate("supplier", "code businessName primaryEmail primaryPhone status procurement")
    .populate("issuingBank", "bankName shortName swiftCode country status")
    .populate("bankAccount", "accountName accountNumber currency status bank ledgerAccount")
    .populate("marginJournalEntry", "entryNo date status totalDebit totalCredit")
    .populate("marginBankTransaction", "reference amount transactionDate status")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

const sendError = (res, error, fallback) => {
  if (error?.code === 11000) return res.status(409).json({ message: "A Commercial LC with the same application/LC number already exists." });
  if (["ValidationError", "CastError"].includes(error?.name)) return res.status(400).json({ message: error.message });
  if (error?.name === "VersionError") return res.status(409).json({ message: "The Commercial LC changed after it was opened. Reload it and try again." });
  return res.status(error?.statusCode || 500).json({ message: error?.statusCode ? error.message : fallback, ...(process.env.NODE_ENV !== "production" ? { error: error.message } : {}) });
};

export const getCommercialLCMeta = async (_req, res) =>
  res.json({ statuses: LC_STATUSES, lcTypes: LC_TYPES, chargeTypes: LC_CHARGE_TYPES });

export const listCommercialLCs = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== "all") {
      const status = clean(req.query.status).toLowerCase();
      if (!LC_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid LC status filter." });
      filter.status = status;
    }
    if (isId(req.query.purchaseOrder)) filter.purchaseOrder = req.query.purchaseOrder;
    if (isId(req.query.supplier)) filter.supplier = req.query.supplier;
    if (isId(req.query.issuingBank)) filter.issuingBank = req.query.issuingBank;
    if (clean(req.query.currency)) filter.currency = clean(req.query.currency).toUpperCase();
    const q = clean(req.query.q);
    if (q) filter.$or = [
      { applicationNo: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      { lcNumber: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
    ];
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const items = await populateLC(CommercialLC.find(filter).sort({ updatedAt: -1, _id: -1 }).limit(limit)).lean();
    return res.json({ count: items.length, commercialLCs: items });
  } catch (error) {
    return sendError(res, error, "Failed to load Commercial LCs.");
  }
};

export const getCommercialLCSummary = async (req, res) => {
  try {
    const [summary] = await CommercialLC.aggregate([
      { $group: {
        _id: null,
        count: { $sum: 1 },
        draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
        opened: { $sum: { $cond: [{ $eq: ["$status", "opened"] }, 1, 0] } },
        inTransit: { $sum: { $cond: [{ $in: ["$status", ["documents_received", "customs_clearance", "goods_received", "settlement_pending"]] }, 1, 0] } },
        settled: { $sum: { $cond: [{ $in: ["$status", ["settled", "closed"]] }, 1, 0] } },
        amount: { $sum: "$baseCurrencyAmount" },
        margin: { $sum: "$marginBaseAmount" },
        charges: { $sum: "$totalCharges" },
      } },
      { $project: { _id: 0 } },
    ]);
    return res.json({ summary: summary || { count: 0, draft: 0, opened: 0, inTransit: 0, settled: 0, amount: 0, margin: 0, charges: 0 } });
  } catch (error) {
    return sendError(res, error, "Failed to load Commercial LC summary.");
  }
};

export const getCommercialLC = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const lc = await populateLC(CommercialLC.findById(req.params.id)).lean();
    if (!lc) return res.status(404).json({ message: "Commercial LC not found." });
    return res.json({ commercialLC: lc });
  } catch (error) {
    return sendError(res, error, "Failed to load Commercial LC.");
  }
};

export const createCommercialLC = async (req, res) => {
  try {
    if (!isId(req.body.purchaseOrder)) return res.status(400).json({ message: "Valid import purchase order is required." });
    const actorId = req.user?._id || null;
    const result = await runMongoTransaction(async (session) => {
      const order = await assertImportPurchaseOrder({ purchaseOrderId: req.body.purchaseOrder, session });
      const patch = buildPatch(req.body);
      const errors = validatePatch(patch, req.body);
      if (errors.length) throw Object.assign(new Error(errors[0]), { statusCode: 400 });
      const applicationNo = await nextImportDocumentNumber({ prefix: "LCAPP", date: patch.applicationDate || new Date(), session });

      let beneficiaryBankName = patch.beneficiaryBankName || "";
      let beneficiaryBankSwift = patch.beneficiaryBankSwift || "";
      if (!beneficiaryBankName || !beneficiaryBankSwift) {
        const supplierDoc = await Supplier.findById(order.supplier).select("+bankAccounts").session(session).lean();
        const primaryBank = supplierDoc?.bankAccounts?.find((b) => b.isPrimary) || supplierDoc?.bankAccounts?.[0];
        if (!beneficiaryBankName) beneficiaryBankName = primaryBank?.bankName || "";
        if (!beneficiaryBankSwift) beneficiaryBankSwift = primaryBank?.swiftCode || primaryBank?.bicCode || "";
      }

      const [lc] = await CommercialLC.create([
        {
          ...patch,
          applicationNo,
          purchaseOrder: order._id,
          supplier: order.supplier,
          beneficiaryBankName,
          beneficiaryBankSwift,
          amount: Number.isFinite(patch.amount) && patch.amount > 0 ? patch.amount : order.grandTotal,
          currency: patch.currency || order.currency || "USD",
          exchangeRate: patch.exchangeRate || order.exchangeRate || 1,
          incoterm: patch.incoterm || order.incoterm || "",
          status: "draft",
          createdBy: actorId,
          updatedBy: actorId,
        },
      ], sessionOptions(session));
      await updatePurchaseOrderImportStatus({ purchaseOrderId: order._id, importStatus: "lc_pending", userId: actorId, session });
      return lc;
    });
    const lc = await populateLC(CommercialLC.findById(result._id)).lean();
    return res.status(201).json({ message: "Commercial LC draft created.", commercialLC: lc });
  } catch (error) {
    return sendError(res, error, "Failed to create Commercial LC.");
  }
};

export const updateCommercialLC = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const patch = buildPatch(req.body);
    if (!Object.keys(patch).length) return res.status(400).json({ message: "No valid Commercial LC fields were provided." });
    const errors = validatePatch(patch, req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const lc = await findCommercialLCForUpdate(req.params.id);
    if (!["draft", "application_submitted"].includes(lc.status)) return res.status(409).json({ message: "Only draft or submitted LC applications can be edited directly. Use amendment after opening." });
    Object.assign(lc, patch, { updatedBy: req.user?._id || null });
    await lc.save();
    return res.json({ message: "Commercial LC updated.", commercialLC: await populateLC(CommercialLC.findById(lc._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to update Commercial LC.");
  }
};

export const submitCommercialLC = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const lc = await findCommercialLCForUpdate(req.params.id);
    await updateLCStatus({ lc, status: "application_submitted", userId: req.user?._id || null });
    return res.json({ message: "LC application submitted.", commercialLC: lc });
  } catch (error) {
    return sendError(res, error, "Failed to submit LC application.");
  }
};

export const openCommercialLC = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const actorId = req.user?._id || null;
    const result = await runMongoTransaction(async (session) => {
      const lc = await findCommercialLCForUpdate(req.params.id, session);
      if (lc.status !== "application_submitted") throw Object.assign(new Error("LC application must be submitted before opening."), { statusCode: 409 });
      const lcNumber = clean(req.body.lcNumber).toUpperCase();
      if (!lcNumber) throw Object.assign(new Error("LC number is required when opening the LC."), { statusCode: 400 });
      if (!isId(req.body.issuingBank || lc.issuingBank)) throw Object.assign(new Error("Issuing bank is required when opening the LC."), { statusCode: 400 });
      if (!isId(req.body.bankAccount || lc.bankAccount)) throw Object.assign(new Error("Bank account is required when opening the LC."), { statusCode: 400 });
      const issuingBankId = req.body.issuingBank || lc.issuingBank;
      const bankAccountId = req.body.bankAccount || lc.bankAccount;
      const bankQuery = Bank.findOne({ _id: issuingBankId, status: "active" }).select("_id");
      const bankAccountQuery = BankAccount.findOne({ _id: bankAccountId, bank: issuingBankId, status: "active" }).select("_id bank currency");
      if (session) { bankQuery.session(session); bankAccountQuery.session(session); }
      const [issuingBank, bankAccount] = await Promise.all([bankQuery.lean(), bankAccountQuery.lean()]);
      if (!issuingBank) throw Object.assign(new Error("Issuing bank is unavailable or inactive."), { statusCode: 409 });
      if (!bankAccount) throw Object.assign(new Error("Bank account must be active and belong to the selected issuing bank."), { statusCode: 409 });
      lc.lcNumber = lcNumber;
      lc.issuingBank = issuingBankId;
      lc.bankAccount = bankAccountId;
      const openedDate = req.body.openedDate ? parseDate(req.body.openedDate) : new Date();
      const expiryDate = req.body.expiryDate ? parseDate(req.body.expiryDate) : null;
      const latestShipmentDate = req.body.latestShipmentDate ? parseDate(req.body.latestShipmentDate) : null;
      if (!openedDate || (req.body.expiryDate && !expiryDate) || (req.body.latestShipmentDate && !latestShipmentDate)) {
        throw Object.assign(new Error("One or more LC dates are invalid."), { statusCode: 400 });
      }
      lc.openedDate = openedDate;
      if (req.body.expiryDate !== undefined) lc.expiryDate = expiryDate;
      if (req.body.latestShipmentDate !== undefined) lc.latestShipmentDate = latestShipmentDate;
      if (req.body.marginPercent !== undefined) lc.marginPercent = Number(req.body.marginPercent);
      if (req.body.marginAmount !== undefined) lc.marginAmount = Number(req.body.marginAmount);
      await updateLCStatus({ lc, status: "opened", userId: actorId, session });
      if (Number(lc.marginBaseAmount || 0) > 0) await postLCMarginAccounting({ lc, userId: actorId, session });
      return lc;
    });
    return res.json({ message: "Commercial LC opened successfully.", commercialLC: await populateLC(CommercialLC.findById(result._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to open Commercial LC.");
  }
};

export const amendCommercialLC = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const lc = await findCommercialLCForUpdate(req.params.id);
    if (!["opened", "documents_received", "customs_clearance", "goods_received", "settlement_pending"].includes(lc.status)) {
      return res.status(409).json({ message: "Only an active opened LC can be amended." });
    }
    const revisedAmount = req.body.amount !== undefined ? Number(req.body.amount) : lc.amount;
    const revisedExpiryDate = req.body.expiryDate !== undefined ? parseDate(req.body.expiryDate) : lc.expiryDate;
    const revisedShipmentDate = req.body.latestShipmentDate !== undefined ? parseDate(req.body.latestShipmentDate) : lc.latestShipmentDate;
    if (!Number.isFinite(revisedAmount) || revisedAmount <= 0) return res.status(400).json({ message: "Revised LC amount must be greater than zero." });
    lc.amendments.push({
      amendmentNo: lc.amendments.length + 1,
      amendmentDate: parseDate(req.body.amendmentDate) || new Date(),
      reason: clean(req.body.reason),
      previousAmount: lc.amount,
      revisedAmount,
      previousExpiryDate: lc.expiryDate,
      revisedExpiryDate,
      previousShipmentDate: lc.latestShipmentDate,
      revisedShipmentDate,
      bankReference: clean(req.body.bankReference),
      amendedBy: req.user?._id || null,
    });
    lc.amount = revisedAmount;
    lc.expiryDate = revisedExpiryDate;
    lc.latestShipmentDate = revisedShipmentDate;
    lc.updatedBy = req.user?._id || null;
    await lc.save();
    return res.json({ message: "Commercial LC amended.", commercialLC: await populateLC(CommercialLC.findById(lc._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to amend Commercial LC.");
  }
};

export const addCommercialLCCharge = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const actorId = req.user?._id || null;
    const result = await runMongoTransaction(async (session) => {
      const lc = await findCommercialLCForUpdate(req.params.id, session);
      if (["draft", "cancelled", "closed"].includes(lc.status)) throw Object.assign(new Error("Charges can only be posted to an active LC."), { statusCode: 409 });
      const chargeType = clean(req.body.chargeType).toLowerCase();
      const amount = Number(req.body.amount);
      if (!LC_CHARGE_TYPES.includes(chargeType)) throw Object.assign(new Error("Invalid LC/import charge type."), { statusCode: 400 });
      if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error("Charge amount must be greater than zero."), { statusCode: 400 });
      lc.charges.push({
        chargeType,
        description: clean(req.body.description),
        amount,
        currency: clean(req.body.currency || lc.currency).toUpperCase(),
        exchangeRate: Number(req.body.exchangeRate || lc.exchangeRate || 1),
        capitalize: req.body.capitalize !== false,
        chargedAt: parseDate(req.body.chargedAt) || new Date(),
        bankAccount: isId(req.body.bankAccount) ? req.body.bankAccount : lc.bankAccount,
        reference: clean(req.body.reference),
        createdBy: actorId,
      });
      await lc.save(sessionOptions(session));
      const charge = lc.charges[lc.charges.length - 1];
      await postLCChargeAccounting({ lc, charge, userId: actorId, session });
      return { lc, chargeId: charge._id };
    });
    const lc = await populateLC(CommercialLC.findById(result.lc._id)).lean();
    return res.status(201).json({ message: "LC/import charge recorded and posted.", commercialLC: lc, chargeId: result.chargeId });
  } catch (error) {
    return sendError(res, error, "Failed to record LC/import charge.");
  }
};

export const settleCommercialLC = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    if (!isId(req.body.vendorBill) || !isId(req.body.bankAccount)) return res.status(400).json({ message: "Valid supplier bill and bank account are required for LC settlement." });
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Settlement amount must be greater than zero." });
    const actorId = req.user?._id || null;
    const result = await runMongoTransaction(async (session) => {
      const lc = await findCommercialLCForUpdate(req.params.id, session);
      if (!["opened", "documents_received", "customs_clearance", "goods_received", "settlement_pending"].includes(lc.status)) {
        throw Object.assign(new Error("Commercial LC is not ready for settlement."), { statusCode: 409 });
      }
      const settlementCurrency = clean(req.body.currency || lc.currency).toUpperCase();
      if (settlementCurrency !== clean(lc.currency).toUpperCase()) {
        throw Object.assign(new Error("LC settlement currency must match the LC currency."), { statusCode: 409 });
      }
      const remaining = money(Number(lc.amount || 0) - Number(lc.settledAmount || 0));
      if (amount > remaining + 0.009) throw Object.assign(new Error("Settlement amount cannot exceed the outstanding LC amount."), { statusCode: 400 });
      lc.settlements.push({
        vendorBill: req.body.vendorBill,
        bankAccount: req.body.bankAccount,
        amount,
        currency: settlementCurrency,
        settledAt: parseDate(req.body.settledAt) || new Date(),
        reference: clean(req.body.reference),
        note: clean(req.body.note),
        settledBy: actorId,
      });
      await lc.save(sessionOptions(session));
      const settlement = lc.settlements[lc.settlements.length - 1];
      await postLCSettlementAccounting({ lc, settlement, userId: actorId, session });
      await lc.validate();
      const nextStatus = Number(lc.outstandingAmount || 0) <= 0.009 ? "settled" : "settlement_pending";
      if (lc.status !== nextStatus) await updateLCStatus({ lc, status: nextStatus, userId: actorId, session });
      else await lc.save(sessionOptions(session));
      return lc;
    });
    return res.json({ message: result.status === "settled" ? "Commercial LC fully settled." : "Commercial LC settlement recorded.", commercialLC: await populateLC(CommercialLC.findById(result._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to settle Commercial LC.");
  }
};

export const closeCommercialLC = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const lc = await findCommercialLCForUpdate(req.params.id);
    if (lc.status !== "settled") return res.status(409).json({ message: "Commercial LC must be fully settled before closing." });
    await updateLCStatus({ lc, status: "closed", userId: req.user?._id || null });
    return res.json({ message: "Commercial LC closed.", commercialLC: lc });
  } catch (error) {
    return sendError(res, error, "Failed to close Commercial LC.");
  }
};

export const cancelCommercialLC = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const lc = await findCommercialLCForUpdate(req.params.id);
    if (lc.settlements?.length || lc.marginJournalEntry || lc.charges?.some((item) => item.journalEntry)) {
      return res.status(409).json({ message: "LC with posted financial activity cannot be cancelled directly. Reverse the financial postings first." });
    }
    lc.cancellationReason = clean(req.body.reason);
    await updateLCStatus({ lc, status: "cancelled", userId: req.user?._id || null });
    await PurchaseOrder.updateOne({ _id: lc.purchaseOrder, tradeType: "import" }, { $set: { importStatus: "lc_pending", updatedBy: req.user?._id || null } });
    return res.json({ message: "Commercial LC cancelled.", commercialLC: lc });
  } catch (error) {
    return sendError(res, error, "Failed to cancel Commercial LC.");
  }
};
