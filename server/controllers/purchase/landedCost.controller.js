import mongoose from "mongoose";
import CommercialLC from "../../models/commercialLC.model.js";
import ImportShipment from "../../models/importShipment.model.js";
import GoodsReceipt from "../../models/goodsReceipt.model.js";
import LandedCost, {
  LANDED_COST_ALLOCATION_BASES,
  LANDED_COST_STATUSES,
} from "../../models/landedCost.model.js";
import {
  buildLandedCostAllocations,
  applyLandedCostToInventory,
} from "../../services/landedCost.service.js";
import { postLandedCostAccounting } from "../../services/importAccounting.service.js";
import { createReversalJournal } from "../../services/accountingPosting.service.js";
import { nextImportDocumentNumber } from "../../services/commercialLC.service.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const sessionOptions = (session) => (session ? { session } : undefined);

const componentTypes = ["freight", "insurance", "customs_duty", "vat_tax", "port_charge", "cnf_charge", "bank_charge", "transport", "inspection", "other"];

const buildComponents = (values = []) => (Array.isArray(values) ? values : []).map((item) => ({
  costType: clean(item.costType).toLowerCase(),
  description: clean(item.description),
  amount: Number(item.amount),
  currency: clean(item.currency || "BDT").toUpperCase(),
  exchangeRate: Number(item.exchangeRate || 1),
  reference: clean(item.reference),
}));

const buildManualAllocations = (values = []) => (Array.isArray(values) ? values : []).map((item) => ({
  goodsReceipt: item.goodsReceipt,
  goodsReceiptLine: item.goodsReceiptLine,
  product: item.product,
  warehouse: item.warehouse,
  receivedQuantity: Number(item.receivedQuantity || 0),
  baseValue: Number(item.baseValue || 0),
  allocationWeight: Number(item.allocationWeight || 0),
  allocatedCost: Number(item.allocatedCost || 0),
}));

const validateComponents = (components) => {
  for (const [index, item] of components.entries()) {
    if (!componentTypes.includes(item.costType)) return `Component ${index + 1}: invalid cost type.`;
    if (!Number.isFinite(item.amount) || item.amount < 0) return `Component ${index + 1}: amount must be non-negative.`;
    if (!Number.isFinite(item.exchangeRate) || item.exchangeRate <= 0) return `Component ${index + 1}: exchange rate must be greater than zero.`;
  }
  return "";
};

const populateLandedCost = (query) => query
  .populate("commercialLC", "applicationNo lcNumber status currency")
  .populate("importShipment", "shipmentNo status billOfLadingNo airwayBillNo")
  .populate("purchaseOrder", "orderNo tradeType importStatus status")
  .populate("goodsReceipts", "receiptNo receiptDate status warehouse totalAcceptedValue movement")
  .populate("allocations.product", "name sku costingMethod")
  .populate("allocations.warehouse", "name code")
  .populate("journalEntry", "entryNo date status totalDebit totalCredit")
  .populate("reversalJournalEntry", "entryNo date status totalDebit totalCredit")
  .populate("createdBy", "name email")
  .populate("finalizedBy", "name email");

const sendError = (res, error, fallback) => {
  if (error?.code === 11000) return res.status(409).json({ message: "A duplicate landed-cost document already exists." });
  if (["ValidationError", "CastError"].includes(error?.name)) return res.status(400).json({ message: error.message });
  if (error?.name === "VersionError") return res.status(409).json({ message: "The landed-cost document changed after it was opened. Reload it and try again." });
  return res.status(error?.statusCode || 500).json({ message: error?.statusCode ? error.message : fallback, ...(process.env.NODE_ENV !== "production" ? { error: error.message } : {}) });
};

export const getLandedCostMeta = async (_req, res) => res.json({ statuses: LANDED_COST_STATUSES, allocationBases: LANDED_COST_ALLOCATION_BASES, componentTypes });

export const listLandedCosts = async (req, res) => {
  try {
    if (!isId(req.params.lcId)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const filter = { commercialLC: req.params.lcId };
    if (req.query.status && req.query.status !== "all") {
      const status = clean(req.query.status).toLowerCase();
      if (!LANDED_COST_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid landed-cost status." });
      filter.status = status;
    }
    const items = await populateLandedCost(LandedCost.find(filter).sort({ createdAt: -1, _id: -1 })).lean();
    return res.json({ count: items.length, landedCosts: items });
  } catch (error) {
    return sendError(res, error, "Failed to load landed costs.");
  }
};

export const getLandedCost = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid landed-cost ID." });
    const item = await populateLandedCost(LandedCost.findById(req.params.id)).lean();
    if (!item) return res.status(404).json({ message: "Landed-cost document not found." });
    return res.json({ landedCost: item });
  } catch (error) {
    return sendError(res, error, "Failed to load landed cost.");
  }
};

export const createLandedCost = async (req, res) => {
  try {
    if (!isId(req.params.lcId)) return res.status(400).json({ message: "Invalid Commercial LC ID." });
    const allocationBasis = clean(req.body.allocationBasis || "value").toLowerCase();
    if (!LANDED_COST_ALLOCATION_BASES.includes(allocationBasis)) return res.status(400).json({ message: "Invalid landed-cost allocation basis." });
    const components = buildComponents(req.body.components);
    const componentError = validateComponents(components);
    if (componentError) return res.status(400).json({ message: componentError });
    if (!components.length) return res.status(400).json({ message: "At least one landed-cost component is required." });
    const receiptIds = [...new Set((Array.isArray(req.body.goodsReceipts) ? req.body.goodsReceipts : []).filter(isId).map(String))];
    if (!receiptIds.length) return res.status(400).json({ message: "At least one posted goods receipt is required." });

    const actorId = req.user?._id || null;
    const item = await runMongoTransaction(async (session) => {
      const lcQuery = CommercialLC.findById(req.params.lcId); if (session) lcQuery.session(session);
      const lc = await lcQuery;
      if (!lc) throw Object.assign(new Error("Commercial LC not found."), { statusCode: 404 });
      if (["draft", "application_submitted", "cancelled"].includes(lc.status)) throw Object.assign(new Error("LC must be active before landed costs can be recorded."), { statusCode: 409 });
      let shipmentId = null;
      if (req.body.importShipment) {
        if (!isId(req.body.importShipment)) throw Object.assign(new Error("Invalid import shipment ID."), { statusCode: 400 });
        const shipmentQuery = ImportShipment.findOne({ _id: req.body.importShipment, commercialLC: lc._id }); if (session) shipmentQuery.session(session);
        const shipment = await shipmentQuery;
        if (!shipment) throw Object.assign(new Error("Import shipment does not belong to this LC."), { statusCode: 409 });
        shipmentId = shipment._id;
      }
      const receiptsQuery = GoodsReceipt.find({ _id: { $in: receiptIds }, purchaseOrder: lc.purchaseOrder, status: "posted" }).select("_id commercialLC importShipment"); if (session) receiptsQuery.session(session);
      const receipts = await receiptsQuery.lean();
      if (receipts.length !== receiptIds.length) throw Object.assign(new Error("Every selected goods receipt must be posted and belong to the LC purchase order."), { statusCode: 409 });
      const invalid = receipts.find((receipt) => receipt.commercialLC && String(receipt.commercialLC) !== String(lc._id));
      if (invalid) throw Object.assign(new Error("A selected goods receipt belongs to a different Commercial LC."), { statusCode: 409 });
      const landedCostNo = await nextImportDocumentNumber({ prefix: "LDC", date: new Date(), session });
      const [created] = await LandedCost.create([{
        landedCostNo,
        commercialLC: lc._id,
        importShipment: shipmentId,
        purchaseOrder: lc.purchaseOrder,
        goodsReceipts: receiptIds,
        allocationBasis,
        components,
        allocations: allocationBasis === "manual" ? buildManualAllocations(req.body.allocations) : [],
        notes: clean(req.body.notes),
        status: "draft",
        createdBy: actorId,
        updatedBy: actorId,
      }], sessionOptions(session));
      return created;
    });
    return res.status(201).json({ message: "Landed-cost draft created.", landedCost: await populateLandedCost(LandedCost.findById(item._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to create landed cost.");
  }
};

export const updateLandedCost = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid landed-cost ID." });
    const item = await LandedCost.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Landed-cost document not found." });
    if (item.status !== "draft") return res.status(409).json({ message: "Only a draft landed-cost document can be edited." });
    if (req.body.allocationBasis !== undefined) {
      const basis = clean(req.body.allocationBasis).toLowerCase();
      if (!LANDED_COST_ALLOCATION_BASES.includes(basis)) return res.status(400).json({ message: "Invalid landed-cost allocation basis." });
      item.allocationBasis = basis;
    }
    if (req.body.components !== undefined) {
      const components = buildComponents(req.body.components);
      const componentError = validateComponents(components);
      if (componentError) return res.status(400).json({ message: componentError });
      item.components = components;
    }
    if (req.body.goodsReceipts !== undefined) {
      const ids = [...new Set((Array.isArray(req.body.goodsReceipts) ? req.body.goodsReceipts : []).filter(isId).map(String))];
      if (!ids.length) return res.status(400).json({ message: "At least one goods receipt is required." });
      item.goodsReceipts = ids;
    }
    if (req.body.allocations !== undefined) item.allocations = buildManualAllocations(req.body.allocations);
    if (req.body.notes !== undefined) item.notes = clean(req.body.notes);
    item.updatedBy = req.user?._id || null;
    await item.save();
    return res.json({ message: "Landed-cost draft updated.", landedCost: await populateLandedCost(LandedCost.findById(item._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to update landed cost.");
  }
};

export const finalizeLandedCost = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid landed-cost ID." });
    const actorId = req.user?._id || null;
    const result = await runMongoTransaction(async (session) => {
      const query = LandedCost.findById(req.params.id); if (session) query.session(session);
      const item = await query;
      if (!item) throw Object.assign(new Error("Landed-cost document not found."), { statusCode: 404 });
      if (item.status !== "draft") throw Object.assign(new Error("Only a draft landed-cost document can be finalized."), { statusCode: 409 });
      await item.validate();
      item.allocations = await buildLandedCostAllocations({ landedCost: item, session });
      item.finalizedAt = new Date();
      item.finalizedBy = actorId;
      item.updatedBy = actorId;
      await item.save(sessionOptions(session));
      await applyLandedCostToInventory({ landedCost: item, direction: 1, userId: actorId, session });
      const journal = await postLandedCostAccounting({ landedCost: item, userId: actorId, session });
      item.journalEntry = journal?._id || null;
      item.status = "finalized";
      await item.save(sessionOptions(session));
      return item;
    });
    return res.json({ message: "Landed cost finalized, capitalized into inventory, and posted to accounting.", landedCost: await populateLandedCost(LandedCost.findById(result._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to finalize landed cost.");
  }
};

export const reverseLandedCost = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid landed-cost ID." });
    const reason = clean(req.body.reason);
    if (!reason) return res.status(400).json({ message: "A reversal reason is required." });
    const actorId = req.user?._id || null;
    const result = await runMongoTransaction(async (session) => {
      const query = LandedCost.findById(req.params.id); if (session) query.session(session);
      const item = await query;
      if (!item) throw Object.assign(new Error("Landed-cost document not found."), { statusCode: 404 });
      if (item.status !== "finalized" || !item.journalEntry) throw Object.assign(new Error("Only a finalized landed cost can be reversed."), { statusCode: 409 });
      await applyLandedCostToInventory({ landedCost: item, direction: -1, userId: actorId, session });
      const reversal = await createReversalJournal({
        originalJournalId: item.journalEntry,
        date: new Date(),
        reason,
        userId: actorId,
        session,
      });
      item.status = "reversed";
      item.reversalJournalEntry = reversal?._id || null;
      item.reversedAt = new Date();
      item.reversedBy = actorId;
      item.reversalReason = reason;
      item.updatedBy = actorId;
      await item.save(sessionOptions(session));
      return item;
    });
    return res.json({ message: "Landed cost reversed.", landedCost: await populateLandedCost(LandedCost.findById(result._id)).lean() });
  } catch (error) {
    return sendError(res, error, "Failed to reverse landed cost.");
  }
};
