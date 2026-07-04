import mongoose from "mongoose";
import ExpenseCategory from "../models/expenseCategory.model.js";
import Expense from "../models/expense.model.js";

const clean = (value) => String(value ?? "").trim();
const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const STATUSES = ["pending", "approved", "paid", "rejected"];
const PAYMENT_METHODS = ["cash", "bank", "card", "mobile_banking", "cheque", "online", "other"];

const parseLimit = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
};

const escapeRegex = (value) => clean(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const duplicateMessage = (err, fallback) => {
  if (err?.code === 11000) return fallback;
  return null;
};

const normalizeCategoryPayload = (body = {}, { isCreate = false } = {}) => {
  const patch = {};
  if (body.name !== undefined || isCreate) {
    patch.name = clean(body.name);
    if (!patch.name) return { ok: false, message: "Category name is required." };
  }
  if (body.description !== undefined) patch.description = clean(body.description);
  if (body.parent !== undefined) patch.parent = isValidObjectId(body.parent) ? body.parent : null;
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  else if (isCreate) patch.isActive = true;
  return { ok: true, patch };
};

const normalizeExpensePayload = async (body = {}, { isCreate = false } = {}) => {
  const patch = {};

  if (body.title !== undefined || isCreate) {
    patch.title = clean(body.title);
    if (!patch.title) return { ok: false, message: "Expense title is required." };
  }

  if (body.category !== undefined || body.categoryId !== undefined || isCreate) {
    const category = clean(body.category ?? body.categoryId);
    if (!isValidObjectId(category)) return { ok: false, message: "Expense category is required." };
    if (!(await ExpenseCategory.exists({ _id: category, isActive: { $ne: false } }))) {
      return { ok: false, message: "Active expense category not found." };
    }
    patch.category = category;
  }

  if (body.expenseDate !== undefined || isCreate) {
    const date = new Date(body.expenseDate);
    if (Number.isNaN(date.getTime())) return { ok: false, message: "Expense date is required." };
    patch.expenseDate = date;
  }

  if (body.amount !== undefined || isCreate) {
    patch.amount = money(body.amount);
    if (patch.amount <= 0) return { ok: false, message: "Amount must be greater than 0." };
  }

  if (body.paymentMethod !== undefined || isCreate) {
    const paymentMethod = clean(body.paymentMethod || "cash").toLowerCase();
    if (!PAYMENT_METHODS.includes(paymentMethod)) return { ok: false, message: "Invalid payment method." };
    patch.paymentMethod = paymentMethod;
  }

  if (body.status !== undefined || isCreate) {
    const status = clean(body.status || "pending").toLowerCase();
    if (!STATUSES.includes(status)) return { ok: false, message: "Invalid expense status." };
    patch.status = status;
  }

  if (body.payeeVendor !== undefined) patch.payeeVendor = clean(body.payeeVendor);
  if (body.invoiceBillNo !== undefined) patch.invoiceBillNo = clean(body.invoiceBillNo);
  if (body.referenceNo !== undefined) patch.referenceNo = clean(body.referenceNo);
  if (body.description !== undefined) patch.description = clean(body.description);
  if (body.branch !== undefined) patch.branch = clean(body.branch);

  if (body.attachment !== undefined) {
    const attachment = body.attachment && typeof body.attachment === "object" ? body.attachment : {};
    patch.attachment = {
      name: clean(attachment.name),
      url: clean(attachment.url),
      type: clean(attachment.type),
      size: Math.max(0, Number(attachment.size || 0)),
    };
  }

  return { ok: true, patch };
};

export const listExpenseCategories = async (req, res) => {
  try {
    const filter = {};
    if (req.query.active !== undefined) filter.isActive = String(req.query.active) === "true";
    if (req.query.parent) filter.parent = isValidObjectId(req.query.parent) ? req.query.parent : null;
    if (req.query.q) filter.name = new RegExp(escapeRegex(req.query.q), "i");

    const categories = await ExpenseCategory.find(filter)
      .populate("parent", "name")
      .sort({ parent: 1, nameLower: 1 })
      .lean();

    return res.json({ categories });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load expense categories.", error: error.message });
  }
};

export const createExpenseCategory = async (req, res) => {
  try {
    const built = normalizeCategoryPayload(req.body, { isCreate: true });
    if (!built.ok) return res.status(400).json({ message: built.message });
    if (built.patch.parent && !(await ExpenseCategory.exists({ _id: built.patch.parent }))) {
      return res.status(404).json({ message: "Parent category not found." });
    }
    const category = await ExpenseCategory.create({ ...built.patch, createdBy: req.user?._id || null, updatedBy: req.user?._id || null });
    const full = await ExpenseCategory.findById(category._id).populate("parent", "name").lean();
    return res.status(201).json({ message: "Expense category created.", category: full });
  } catch (error) {
    const duplicate = duplicateMessage(error, "Expense category already exists under this parent.");
    if (duplicate) return res.status(409).json({ message: duplicate });
    return res.status(500).json({ message: "Failed to create expense category.", error: error.message });
  }
};

export const updateExpenseCategory = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid category." });
    const built = normalizeCategoryPayload(req.body);
    if (!built.ok) return res.status(400).json({ message: built.message });
    if (built.patch.parent && String(built.patch.parent) === String(req.params.id)) {
      return res.status(400).json({ message: "A category cannot be its own parent." });
    }
    if (built.patch.parent && !(await ExpenseCategory.exists({ _id: built.patch.parent }))) {
      return res.status(404).json({ message: "Parent category not found." });
    }
    const category = await ExpenseCategory.findByIdAndUpdate(
      req.params.id,
      { ...built.patch, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).populate("parent", "name");
    if (!category) return res.status(404).json({ message: "Expense category not found." });
    return res.json({ message: "Expense category updated.", category });
  } catch (error) {
    const duplicate = duplicateMessage(error, "Expense category already exists under this parent.");
    if (duplicate) return res.status(409).json({ message: duplicate });
    return res.status(500).json({ message: "Failed to update expense category.", error: error.message });
  }
};

export const deleteExpenseCategory = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid category." });
    if (await ExpenseCategory.exists({ parent: req.params.id })) {
      return res.status(400).json({ message: "Delete subcategories first." });
    }
    if (await Expense.exists({ category: req.params.id })) {
      return res.status(400).json({ message: "This category is used by expenses." });
    }
    const category = await ExpenseCategory.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: "Expense category not found." });
    return res.json({ message: "Expense category deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete expense category.", error: error.message });
  }
};

export const listExpenses = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = parseLimit(req.query.limit);
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status).toLowerCase();
    if (req.query.category && isValidObjectId(req.query.category)) filter.category = req.query.category;
    if (req.query.paymentMethod && req.query.paymentMethod !== "all") filter.paymentMethod = clean(req.query.paymentMethod).toLowerCase();
    if (req.query.from || req.query.to) {
      filter.expenseDate = {};
      if (req.query.from) filter.expenseDate.$gte = new Date(req.query.from);
      if (req.query.to) filter.expenseDate.$lte = new Date(req.query.to);
    }
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(req.query.q), "i");
      filter.$or = [{ title: rx }, { payeeVendor: rx }, { invoiceBillNo: rx }, { referenceNo: rx }];
    }

    const [expenses, total, summary] = await Promise.all([
      Expense.find(filter)
        .populate("category", "name parent")
        .populate("createdBy", "name email")
        .sort({ expenseDate: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Expense.countDocuments(filter),
      Expense.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ]),
    ]);

    return res.json({
      expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: summary.reduce((acc, item) => {
        acc[item._id] = { count: item.count, amount: money(item.amount) };
        acc.total.count += item.count;
        acc.total.amount = money(acc.total.amount + item.amount);
        return acc;
      }, { total: { count: 0, amount: 0 } }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load expenses.", error: error.message });
  }
};

export const createExpense = async (req, res) => {
  try {
    const built = await normalizeExpensePayload(req.body, { isCreate: true });
    if (!built.ok) return res.status(400).json({ message: built.message });
    const expense = await Expense.create({ ...built.patch, createdBy: req.user?._id || null, updatedBy: req.user?._id || null });
    const full = await Expense.findById(expense._id).populate("category", "name").lean();
    return res.status(201).json({ message: "Expense created.", expense: full });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create expense.", error: error.message });
  }
};

export const updateExpense = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid expense." });
    const built = await normalizeExpensePayload(req.body);
    if (!built.ok) return res.status(400).json({ message: built.message });
    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      { ...built.patch, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    ).populate("category", "name");
    if (!expense) return res.status(404).json({ message: "Expense not found." });
    return res.json({ message: "Expense updated.", expense });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update expense.", error: error.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid expense." });
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found." });
    return res.json({ message: "Expense deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete expense.", error: error.message });
  }
};
