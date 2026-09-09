import mongoose from "mongoose";
import InventoryRevaluation from "../../models/inventory/inventoryRevaluation.model.js";
import InventoryValuation, {
  roundMoney,
  roundQuantity,
} from "../../models/inventory/inventoryValuation.model.js";
import Product from "../../models/inventory/product.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";
import {
  getOrCreateValuation,
} from "../../services/inventoryCosting.service.js";
import {
  postInventoryRevaluationJournal,
  resolveInventoryAssetAccount,
} from "../../services/inventoryAccounting.service.js";
import { resolveAccountingAccount } from "../../services/accountingPosting.service.js";

const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const clean = (value) => String(value ?? "").trim();

export const createAndPostRevaluation = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { productId, warehouseId, newUnitCost, reason } = req.body;

    if (!isId(productId) || !isId(warehouseId)) {
      return res.status(400).json({
        message: "Valid product ID and warehouse ID are required.",
      });
    }

    const unitCost = Number(newUnitCost);
    if (isNaN(unitCost) || unitCost < 0) {
      return res.status(400).json({
        message: "A non-negative new unit cost is required.",
      });
    }

    if (!clean(reason)) {
      return res.status(400).json({
        message: "A reason for revaluation is required.",
      });
    }

    const result = await runMongoTransaction(async (session) => {
      const product = await Product.findOne({
        _id: productId,
        ...(tenantId ? { tenantId } : {}),
      }).session(session);
      if (!product) {
        throw Object.assign(new Error("Product not found."), { statusCode: 404 });
      }

      const warehouse = await Warehouse.findOne({
        _id: warehouseId,
        ...(tenantId ? { tenantId } : {}),
      }).session(session);
      if (!warehouse) {
        throw Object.assign(new Error("Warehouse not found."), { statusCode: 404 });
      }

      const valuation = await getOrCreateValuation({
        tenantId,
        productId,
        warehouseId,
        session,
      });

      const quantity = valuation.valuationQuantity || 0;
      if (quantity <= 0) {
        throw Object.assign(
          new Error("Cannot revalue inventory when quantity on hand is zero or negative."),
          { statusCode: 400 }
        );
      }

      const oldUnitCost = roundMoney(valuation.averageCost || 0);
      const newCost = roundMoney(unitCost);
      const oldInventoryValue = roundMoney(valuation.inventoryValue || quantity * oldUnitCost);
      const newInventoryValue = roundMoney(quantity * newCost);
      const valueDifference = roundMoney(newInventoryValue - oldInventoryValue);

      if (valueDifference === 0) {
        throw Object.assign(
          new Error("New unit cost is identical to current cost; no revaluation needed."),
          { statusCode: 400 }
        );
      }

      const revalNo = `REV-${Date.now()}-${String(productId).slice(-4).toUpperCase()}`;

      const assetAccount = await resolveInventoryAssetAccount({
        tenantId,
        productId,
        warehouseId,
        session,
      });

      const gainLossAccount = (
        await resolveAccountingAccount({
          tenantId,
          settingsField: "inventoryRevaluationAccount",
          fallbackCode: "5090",
          session,
        })
      )._id;

      const [revaluation] = await InventoryRevaluation.create(
        [
          {
            tenantId,
            revaluationNo: revalNo,
            product: productId,
            warehouse: warehouseId,
            revaluationDate: new Date(),
            costingMethod: valuation.costingMethod,
            quantity,
            oldUnitCost,
            newUnitCost: newCost,
            oldInventoryValue,
            newInventoryValue,
            valueDifference,
            reason: clean(reason),
            status: "posted",
            assetAccount,
            gainLossAccount,
            createdBy: req.user?._id || null,
            approvedBy: req.user?._id || null,
            postedAt: new Date(),
          },
        ],
        { session }
      );

      // Post GL journal entry atomically
      const journal = await postInventoryRevaluationJournal({
        revaluation,
        userId: req.user?._id || null,
        session,
      });

      if (journal) {
        revaluation.journalEntry = journal._id;
        await revaluation.save({ session });
      }

      // Update financial valuation
      valuation.averageCost = newCost;
      valuation.inventoryValue = newInventoryValue;
      if (valuation.costingMethod === "standard") {
        valuation.standardCost = newCost;
        product.standardCost = newCost;
        await product.save({ session });
      }
      valuation.valuationVersion = (valuation.valuationVersion || 0) + 1;
      valuation.lastValuationAt = new Date();
      valuation.updatedBy = req.user?._id || null;
      await valuation.save({ session });

      return revaluation;
    });

    return res.status(201).json({
      success: true,
      message: "Inventory revalued and posted successfully.",
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to process inventory revaluation.",
    });
  }
};

export const listRevaluations = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { product, warehouse, status, limit = 50, page = 1 } = req.query;

    const filter = { ...(tenantId ? { tenantId } : {}) };
    if (isId(product)) filter.product = product;
    if (isId(warehouse)) filter.warehouse = warehouse;
    if (status) filter.status = status;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      InventoryRevaluation.find(filter)
        .populate("product", "name sku")
        .populate("warehouse", "name code")
        .populate("journalEntry", "entryNo totalDebit totalCredit")
        .sort({ revaluationDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      InventoryRevaluation.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch revaluations.",
    });
  }
};

export const getRevaluationById = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!isId(req.params.id)) {
      return res.status(400).json({ message: "Invalid revaluation ID." });
    }

    const item = await InventoryRevaluation.findOne({
      _id: req.params.id,
      ...(tenantId ? { tenantId } : {}),
    })
      .populate("product", "name sku")
      .populate("warehouse", "name code")
      .populate("journalEntry", "entryNo totalDebit totalCredit lines")
      .lean();

    if (!item) {
      return res.status(404).json({ message: "Inventory revaluation not found." });
    }

    return res.json({ success: true, data: item });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch revaluation.",
    });
  }
};
