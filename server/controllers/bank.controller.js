import mongoose from "mongoose";
import Bank from "../models/bank.model.js";
import BankAccount from "../models/bankAccount.model.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const parseLimit = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.min(Math.max(n, 1), 150);
};

const textRegex = (value) => {
  const q = clean(value);
  if (!q) return null;
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
};

const buildBankPayload = (body = {}, userId = null) => {
  const payload = {};
  if (body.bankName !== undefined) payload.bankName = clean(body.bankName);
  if (body.shortName !== undefined) payload.shortName = clean(body.shortName).toUpperCase();
  if (body.bankType !== undefined) payload.bankType = clean(body.bankType || "private").toLowerCase();
  if (body.country !== undefined) payload.country = clean(body.country || "Bangladesh");
  if (body.swiftCode !== undefined) payload.swiftCode = clean(body.swiftCode).toUpperCase();
  if (body.website !== undefined) payload.website = clean(body.website);
  if (body.status !== undefined) payload.status = clean(body.status || "active").toLowerCase();
  if (userId) payload.updatedBy = userId;
  return payload;
};

const buildBankAccountPayload = (body = {}, userId = null) => {
  const payload = {};
  if (body.bank !== undefined) payload.bank = clean(body.bank);
  if (body.accountName !== undefined) payload.accountName = clean(body.accountName);
  if (body.accountNumber !== undefined) payload.accountNumber = clean(body.accountNumber);
  if (body.accountType !== undefined) payload.accountType = clean(body.accountType || "current").toLowerCase();
  if (body.openingBalance !== undefined) payload.openingBalance = Number(body.openingBalance);
  if (body.branchName !== undefined) payload.branchName = clean(body.branchName);
  if (body.routingNumber !== undefined) payload.routingNumber = clean(body.routingNumber);
  if (body.swiftCode !== undefined) payload.swiftCode = clean(body.swiftCode).toUpperCase();
  if (body.currency !== undefined) payload.currency = clean(body.currency || "BDT").toUpperCase();
  if (body.description !== undefined) payload.description = clean(body.description);
  if (body.status !== undefined) payload.status = clean(body.status || "active").toLowerCase();
  if (userId) payload.updatedBy = userId;
  return payload;
};

export const listBanks = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status).toLowerCase();
    if (req.query.bankType && req.query.bankType !== "all") filter.bankType = clean(req.query.bankType).toLowerCase();
    if (req.query.country) filter.country = clean(req.query.country);
    const rx = textRegex(req.query.q);
    if (rx) filter.$or = [{ bankName: rx }, { shortName: rx }, { country: rx }, { swiftCode: rx }];

    const banks = await Bank.find(filter)
      .sort({ status: 1, bankNameLower: 1, _id: 1 })
      .limit(limit)
      .lean();

    return res.json({ count: banks.length, banks });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load banks.", error: error.message });
  }
};

export const createBank = async (req, res) => {
  try {
    const payload = buildBankPayload(req.body, req.user?._id || null);
    if (!payload.bankName) return res.status(400).json({ message: "Bank name is required." });
    if (!payload.shortName) return res.status(400).json({ message: "Short name is required." });
    const bank = await Bank.create({ ...payload, createdBy: req.user?._id || null });
    return res.status(201).json({ message: "Bank created.", bank });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : 500).json({
      message: duplicate ? "A bank with this short name already exists." : "Failed to create bank.",
      error: error.message,
    });
  }
};

export const updateBank = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid bank ID." });
    const bank = await Bank.findByIdAndUpdate(
      req.params.id,
      buildBankPayload(req.body, req.user?._id || null),
      { new: true, runValidators: true }
    );
    if (!bank) return res.status(404).json({ message: "Bank not found." });
    return res.json({ message: "Bank updated.", bank });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : 500).json({
      message: duplicate ? "A bank with this short name already exists." : "Failed to update bank.",
      error: error.message,
    });
  }
};

export const deleteBank = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid bank ID." });
    const linkedAccounts = await BankAccount.exists({ bank: req.params.id });
    if (linkedAccounts) return res.status(409).json({ message: "This bank has accounts. Delete or move those accounts first." });
    const bank = await Bank.findByIdAndDelete(req.params.id);
    if (!bank) return res.status(404).json({ message: "Bank not found." });
    return res.json({ message: "Bank deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete bank.", error: error.message });
  }
};

export const listBankAccounts = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const filter = {};
    if (isId(req.query.bank)) filter.bank = req.query.bank;
    if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status).toLowerCase();
    if (req.query.accountType && req.query.accountType !== "all") filter.accountType = clean(req.query.accountType).toLowerCase();
    if (req.query.currency && req.query.currency !== "all") filter.currency = clean(req.query.currency).toUpperCase();
    const rx = textRegex(req.query.q);
    if (rx) {
      filter.$or = [
        { accountName: rx },
        { accountNumber: rx },
        { branchName: rx },
        { routingNumber: rx },
        { swiftCode: rx },
        { currency: rx },
      ];
    }

    const accounts = await BankAccount.find(filter)
      .populate("bank", "bankName shortName bankType country status")
      .sort({ status: 1, accountNameLower: 1, _id: 1 })
      .limit(limit)
      .lean();

    return res.json({ count: accounts.length, accounts });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load bank accounts.", error: error.message });
  }
};

export const createBankAccount = async (req, res) => {
  try {
    const payload = buildBankAccountPayload(req.body, req.user?._id || null);
    if (!isId(payload.bank)) return res.status(400).json({ message: "Select bank is required." });
    if (!payload.accountName) return res.status(400).json({ message: "Account name is required." });
    if (!payload.accountNumber) return res.status(400).json({ message: "Account number is required." });
    if (!payload.accountType) return res.status(400).json({ message: "Account type is required." });
    if (!Number.isFinite(payload.openingBalance)) return res.status(400).json({ message: "Opening balance is required." });
    if (!payload.status) return res.status(400).json({ message: "Status is required." });

    const bank = await Bank.exists({ _id: payload.bank });
    if (!bank) return res.status(404).json({ message: "Selected bank was not found." });

    const account = await BankAccount.create({ ...payload, createdBy: req.user?._id || null });
    const populated = await account.populate("bank", "bankName shortName bankType country status");
    return res.status(201).json({ message: "Bank account created.", account: populated });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : 500).json({
      message: duplicate ? "This account number already exists under the selected bank." : "Failed to create bank account.",
      error: error.message,
    });
  }
};

export const updateBankAccount = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid bank account ID." });
    const payload = buildBankAccountPayload(req.body, req.user?._id || null);
    if (payload.bank !== undefined && !isId(payload.bank)) return res.status(400).json({ message: "Select bank is required." });
    if (payload.openingBalance !== undefined && !Number.isFinite(payload.openingBalance)) {
      return res.status(400).json({ message: "Opening balance is required." });
    }
    if (payload.bank) {
      const bank = await Bank.exists({ _id: payload.bank });
      if (!bank) return res.status(404).json({ message: "Selected bank was not found." });
    }

    const account = await BankAccount.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
      .populate("bank", "bankName shortName bankType country status");
    if (!account) return res.status(404).json({ message: "Bank account not found." });
    return res.json({ message: "Bank account updated.", account });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : 500).json({
      message: duplicate ? "This account number already exists under the selected bank." : "Failed to update bank account.",
      error: error.message,
    });
  }
};

export const deleteBankAccount = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid bank account ID." });
    const account = await BankAccount.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ message: "Bank account not found." });
    return res.json({ message: "Bank account deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete bank account.", error: error.message });
  }
};
