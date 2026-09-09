import mongoose from "mongoose";
import Product from "../../models/inventory/product.model.js";
import ProductStock from "../../models/inventory/productStock.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import WarehouseLocation from "../../models/inventory/warehouseLocation.model.js";
import {
  ConsumptionHistory,
  InventoryLoss,
  InventoryPreference,
  InventoryTracking,
  PendingInventory,
  StockInspection,
  StockIssue,
  StockRequest,
  WarehouseCheck,
} from "../../models/inventory/inventoryOperations.model.js";
import { postStockMovement } from "../../services/inventoryPosting.service.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";
import { getReqMeta, writeAudit } from "../../utils/audit.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const num = (value) => Number(value || 0);
const round = (value) => Math.round((num(value) + Number.EPSILON) * 1e6) / 1e6;
const reference = (prefix, productCode = "") =>
  `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}${productCode ? `-${productCode}` : ""}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
const fail = (res, error, fallback) =>
  res.status(error.statusCode || (error.name === "ValidationError" ? 400 : 500)).json({
    message: error.statusCode || error.name === "ValidationError" ? error.message : fallback,
    error: error.message,
  });
const page = (query) => ({
  limit: Math.min(Math.max(Number(query.limit) || 30, 1), 200),
  skip: Math.max(Number(query.skip) || 0, 0),
});
const sessionOpt = (session) => (session ? { session } : {});
const idString = (value) => String(value?._id || value || "");
const positionKey = (value) => `${idString(value.product)}:${idString(value.location)}`;

export const buildMissingWarehouseSchedules = (
  warehouses = [],
  schedules = [],
  userId,
  now = new Date(),
  tenantId = null
) => {
  const scheduled = new Set(schedules.map((item) => idString(item.warehouse)));
  return warehouses
    .filter((warehouse) => !scheduled.has(idString(warehouse)))
    .map((warehouse) => ({
      ...(tenantId ? { tenantId } : {}),
      warehouse: warehouse._id,
      frequencyDays: 365,
      inspectionMode: "full_warehouse",
      status: "waiting",
      cycleNumber: 1,
      nextInspectionDate: new Date(now.getTime() + 365 * 86400000),
      createdBy: userId,
      updatedBy: userId,
    }));
};

export const pickNextWarehouseSchedule = (schedules = []) =>
  schedules
    .filter((item) => ["waiting", "processing"].includes(item.status))
    .sort((left, right) => new Date(left.nextInspectionDate || 0) - new Date(right.nextInspectionDate || 0))[0] ||
  null;

export const isWarehouseCycleComplete = (positions = [], inspections = []) => {
  if (!positions.length) return false;
  const completed = new Set(inspections.filter((item) => item.status === "completed").map(positionKey));
  return positions.every((position) => completed.has(positionKey(position)));
};

export const advanceWarehouseCheckCycle = (schedule, completedAt = new Date()) => ({
  status: "waiting",
  cycleNumber: Number(schedule.cycleNumber || 1) + 1,
  lastInspectionDate: completedAt,
  nextInspectionDate: new Date(completedAt.getTime() + Number(schedule.frequencyDays || 365) * 86400000),
  queuedInspections: [],
});

export const buildStockRequestCreateData = ({
  tenantId = null,
  body = {},
  requester,
  fallbackDepartment = null,
  actor,
  reference: requestReference,
}) => ({
  ...(tenantId ? { tenantId } : {}),
  requestReference,
  product: body.product,
  requestedQuantity: round(body.requestedQuantity),
  requester,
  department: isId(body.department) ? body.department : fallbackDepartment || null,
  notes: clean(body.notes),
  requiredDate: body.requiredDate ? new Date(`${String(body.requiredDate).slice(0, 10)}T00:00:00.000Z`) : null,
  createdBy: actor,
  updatedBy: actor,
});

export const buildStockRequestUpdateData = (body = {}, actor) => ({
  product: body.product,
  requester: body.requester,
  department: isId(body.department) ? body.department : null,
  requestedQuantity: round(body.requestedQuantity),
  notes: clean(body.notes),
  requiredDate: body.requiredDate ? new Date(`${String(body.requiredDate).slice(0, 10)}T00:00:00.000Z`) : null,
  updatedBy: actor,
});

export const attachStockRequestAvailability = (requests = [], stocks = []) => {
  const totals = new Map();
  stocks.forEach((stock) => {
    if (stock.status && stock.status !== "active") return;
    const productId = idString(stock.product);
    totals.set(productId, round((totals.get(productId) || 0) + num(stock.availableQuantity)));
  });
  return requests.map((request) => ({ ...request, availableQuantity: totals.get(idString(request.product)) || 0 }));
};

async function productAndPosition(productId, warehouseId, locationId, tenantId, session) {
  const [product, warehouse, location] = await Promise.all([
    Product.findOne({ _id: productId, ...(tenantId ? { tenantId } : {}) }).session(session),
    Warehouse.findOne({ _id: warehouseId, ...(tenantId ? { tenantId } : {}) }).session(session),
    WarehouseLocation.findOne({ _id: locationId, ...(tenantId ? { tenantId } : {}) }).session(session),
  ]);
  if (!product || product.status !== "active" || !product.trackInventory) {
    throw Object.assign(new Error("Select an active inventory product."), { statusCode: 400 });
  }
  if (!warehouse || warehouse.status !== "active") {
    throw Object.assign(new Error("Select an active warehouse."), { statusCode: 400 });
  }
  if (!location || location.status !== "active" || String(location.warehouse) !== String(warehouse._id)) {
    throw Object.assign(new Error("Select an active bin belonging to the warehouse."), { statusCode: 400 });
  }
  return { product, warehouse, location };
}

export const getPreferences = async (req, res) => {
  const tenantId = req.tenantId;
  const filter = tenantId ? { tenantId, key: "default" } : { key: "default" };
  const update = tenantId ? { $setOnInsert: { tenantId, key: "default" } } : { $setOnInsert: { key: "default" } };
  return res.json(await InventoryPreference.findOneAndUpdate(filter, update, { upsert: true, new: true }));
};

export const updatePreferences = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const patch = { updatedBy: req.user._id };
    if (["fifo", "lifo"].includes(req.body.stockIssueMethod)) patch.stockIssueMethod = req.body.stockIssueMethod;
    if (Number(req.body.nearExpiryAlertDays) > 0) patch.nearExpiryAlertDays = Number(req.body.nearExpiryAlertDays);
    if (typeof req.body.automaticProductCodes === "boolean") patch.automaticProductCodes = req.body.automaticProductCodes;

    const filter = tenantId ? { tenantId, key: "default" } : { key: "default" };
    const setOnInsert = tenantId ? { tenantId, key: "default" } : { key: "default" };
    const result = await InventoryPreference.findOneAndUpdate(
      filter,
      { $set: patch, $setOnInsert: setOnInsert },
      { upsert: true, new: true, runValidators: true }
    );
    return res.json(result);
  } catch (e) {
    return fail(res, e, "Failed to update inventory preferences.");
  }
};

export const listPendingInventory = async (req, res) => {
  const tenantId = req.tenantId;
  const { limit, skip } = page(req.query);
  const filter = tenantId ? { tenantId } : {};
  if (req.query.status && req.query.status !== "all") filter.status = req.query.status;

  const [items, total] = await Promise.all([
    PendingInventory.find(filter)
      .populate("product", "name sku imageUrl trackingType")
      .sort({ arrivalDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PendingInventory.countDocuments(filter),
  ]);
  res.json({ items, total, limit, skip });
};

export const createPendingInventory = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const quantity = round(req.body.acceptedQuantity);
    if (quantity <= 0 || num(req.body.unitCost) < 0) {
      return res.status(400).json({ message: "Accepted quantity and non-negative unit cost are required." });
    }
    const product = isId(req.body.product)
      ? await Product.findOne({ _id: req.body.product, ...(tenantId ? { tenantId } : {}) })
      : null;
    if ((!product || product.status !== "active" || !product.trackInventory) && req.body.source !== "quick_purchase") {
      return res.status(400).json({ message: "Normal inventory must use an active Product template." });
    }
    const item = await PendingInventory.create({
      ...(tenantId ? { tenantId } : {}),
      reference: clean(req.body.reference) || reference(req.body.source === "quick_purchase" ? "QP" : "PIN"),
      product: product?._id || null,
      quickProductName: clean(req.body.quickProductName),
      quickProductCode: clean(req.body.quickProductCode),
      acceptedQuantity: quantity,
      remainingQuantity: quantity,
      unitCost: num(req.body.unitCost),
      trackingType: product?.trackingType || req.body.trackingType || "none",
      source: req.body.source || "manual",
      purchaseReference: clean(req.body.purchaseReference),
      purchaseId: isId(req.body.purchaseId) ? req.body.purchaseId : null,
      arrivalDate: req.body.arrivalDate || new Date(),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    return res.status(201).json(item);
  } catch (e) {
    return fail(res, e, "Failed to create pending inventory.");
  }
};

export const assignPendingInventory = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const result = await runMongoTransaction(async (session) => {
      const item = await PendingInventory.findOne({
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
      }).session(session);
      if (!item || !["pending", "partially_assigned"].includes(item.status)) {
        throw Object.assign(new Error("Pending inventory is not assignable."), { statusCode: 409 });
      }
      let product = item.product
        ? await Product.findOne({ _id: item.product, ...(tenantId ? { tenantId } : {}) }).session(session)
        : null;
      if (!product) {
        const code = item.quickProductCode || `QP${Date.now().toString().slice(-8)}`;
        [product] = await Product.create(
          [
            {
              ...(tenantId ? { tenantId } : {}),
              name: item.quickProductName || `Quick Purchase ${code}`,
              sku: code,
              productType: "inventory",
              trackInventory: true,
              trackingType: item.trackingType,
              purchasePrice: item.unitCost,
              status: "active",
              createdBy: req.user._id,
              updatedBy: req.user._id,
            },
          ],
          sessionOpt(session)
        );
        item.product = product._id;
      }
      const quantity = round(req.body.quantity || item.remainingQuantity);
      if (quantity <= 0 || quantity > item.remainingQuantity) {
        throw Object.assign(new Error("Assignment quantity exceeds the pending quantity."), { statusCode: 400 });
      }
      const { warehouse, location } = await productAndPosition(
        product._id,
        req.body.warehouse,
        req.body.location,
        tenantId,
        session
      );

      const movement = await postStockMovement({
        tenantId: tenantId || item.tenantId,
        movementType: item.source === "quality_inspection" ? "purchase_receipt" : "opening_stock",
        reference: item.reference,
        sourceType: "pending_inventory",
        sourceId: item._id,
        reason: "Pending inventory warehouse assignment",
        lines: [
          {
            product: product._id,
            effect: "in",
            destinationWarehouse: warehouse._id,
            destinationLocation: location._id,
            quantity,
            requestedUnitCost: item.unitCost,
            lotNumber: clean(req.body.batchNumber),
            serialNumbers: req.body.serialNumbers || [],
            expiryDate: req.body.expiryDate || null,
          },
        ],
        userId: req.user._id,
        session,
      });

      if (product.trackingType !== "none") {
        const serials = product.trackingType === "serial" ? req.body.serialNumbers || [] : [""];
        if (product.trackingType === "serial" && serials.length !== quantity) {
          throw Object.assign(new Error("Provide one serial number for every received unit."), { statusCode: 400 });
        }
        for (const serial of serials) {
          await InventoryTracking.create(
            [
              {
                ...(tenantId ? { tenantId } : {}),
                trackingReference: reference("TRK", product.sku),
                trackingType: product.trackingType,
                product: product._id,
                warehouse: warehouse._id,
                location: location._id,
                batchNumber: clean(req.body.batchNumber),
                serialNumber: clean(serial),
                arrivalDate: item.arrivalDate,
                expiryDate: req.body.expiryDate || null,
                originalQuantity: product.trackingType === "serial" ? 1 : quantity,
                remainingQuantity: product.trackingType === "serial" ? 1 : quantity,
                usableQuantity: product.trackingType === "serial" ? 1 : quantity,
                unitCost: item.unitCost,
                sourceType: item.source,
                sourceId: movement._id,
                createdBy: req.user._id,
                updatedBy: req.user._id,
              },
            ],
            sessionOpt(session)
          );
        }
      }
      item.remainingQuantity = round(item.remainingQuantity - quantity);
      item.status = item.remainingQuantity === 0 ? "assigned" : "partially_assigned";
      item.assignments.push({
        warehouse: warehouse._id,
        location: location._id,
        quantity,
        movement: movement._id,
        assignedAt: new Date(),
        assignedBy: req.user._id,
      });
      item.updatedBy = req.user._id;
      await item.save(sessionOpt(session));
      return item;
    });
    return res.json(result);
  } catch (e) {
    return fail(res, e, "Failed to assign pending inventory.");
  }
};

export const listStockRequests = async (req, res) => {
  const tenantId = req.tenantId;
  const { limit, skip } = page(req.query);
  const filter = tenantId ? { tenantId } : {};
  if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
  const [items, total] = await Promise.all([
    StockRequest.find(filter)
      .populate("product", "name sku imageUrl baseUnit")
      .populate("requester approver", "name email employeeId")
      .populate("department", "name")
      .sort({ requestDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockRequest.countDocuments(filter),
  ]);
  const productIds = [...new Set(items.map((item) => idString(item.product)).filter(Boolean))];
  const stocks = productIds.length
    ? await ProductStock.find({
        ...(tenantId ? { tenantId } : {}),
        product: { $in: productIds },
        status: "active",
      })
        .select("product availableQuantity status")
        .lean()
    : [];
  res.json({ items: attachStockRequestAvailability(items, stocks), total, limit, skip });
};

export const createStockRequest = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const product = await Product.findOne({ _id: req.body.product, ...(tenantId ? { tenantId } : {}) });
    if (!product || product.status !== "active" || !product.trackInventory) {
      return res.status(400).json({ message: "Select an active inventory product." });
    }
    if (round(req.body.requestedQuantity) <= 0) {
      return res.status(400).json({ message: "Requested quantity must be greater than zero." });
    }
    const requester = isId(req.body.requester) ? req.body.requester : req.user._id;
    const requesterDoc =
      idString(requester) === idString(req.user._id)
        ? req.user
        : await mongoose.model("User").findById(requester);
    if (!requesterDoc) return res.status(400).json({ message: "Requester is required." });
    const item = await StockRequest.create(
      buildStockRequestCreateData({
        tenantId,
        body: { ...req.body, product: product._id },
        requester,
        fallbackDepartment: requesterDoc.department,
        actor: req.user._id,
        reference: reference("SRQ", product.sku),
      })
    );
    return res.status(201).json(item);
  } catch (e) {
    return fail(res, e, "Failed to create stock request.");
  }
};

export const updateStockRequest = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const item = await StockRequest.findOne({ _id: req.params.id, ...(tenantId ? { tenantId } : {}) });
    if (!item || item.status !== "pending") {
      return res.status(409).json({ message: "Only pending requests can be edited." });
    }
    const product = await Product.findOne({ _id: req.body.product, ...(tenantId ? { tenantId } : {}) });
    if (!product || product.status !== "active" || !product.trackInventory) {
      return res.status(400).json({ message: "Select an active inventory product." });
    }
    if (!isId(req.body.requester) || round(req.body.requestedQuantity) <= 0) {
      return res.status(400).json({ message: "Requester and a positive quantity are required." });
    }
    const before = item.toObject();
    Object.assign(item, buildStockRequestUpdateData({ ...req.body, product: product._id }, req.user._id));
    await item.save();
    await writeAudit({
      actorId: req.user._id,
      action: "update",
      entityType: "StockRequest",
      entityId: item._id,
      before,
      after: item.toObject(),
      meta: getReqMeta(req),
    });
    return res.json(item);
  } catch (e) {
    return fail(res, e, "Failed to update stock request.");
  }
};

export const approveStockRequest = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const item = await StockRequest.findOne({ _id: req.params.id, ...(tenantId ? { tenantId } : {}) });
    if (!item || item.status !== "pending") {
      return res.status(409).json({ message: "Only pending requests can be approved." });
    }
    const match = { product: item.product, status: "active" };
    if (tenantId) match.tenantId = tenantId;
    const rows = await ProductStock.aggregate([
      { $match: match },
      { $group: { _id: null, available: { $sum: "$availableQuantity" } } },
    ]);
    if (num(rows[0]?.available) < item.requestedQuantity) {
      return res.status(409).json({
        message: "Insufficient available stock. The request remains pending.",
        availableQuantity: num(rows[0]?.available),
      });
    }
    item.status = "approved";
    item.approver = req.user._id;
    item.approvedAt = new Date();
    item.updatedBy = req.user._id;
    await item.save();
    return res.json(item);
  } catch (e) {
    return fail(res, e, "Failed to approve stock request.");
  }
};

export const rejectStockRequest = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const item = await StockRequest.findOne({ _id: req.params.id, ...(tenantId ? { tenantId } : {}) });
    if (!item || !["pending", "approved"].includes(item.status)) {
      return res.status(409).json({ message: "Request cannot be rejected." });
    }
    item.status = "rejected";
    item.rejectionReason = clean(req.body.reason);
    item.rejectedAt = new Date();
    item.approver = req.user._id;
    await item.save();
    return res.json(item);
  } catch (e) {
    return fail(res, e, "Failed to reject stock request.");
  }
};

export const issueStockRequest = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const result = await runMongoTransaction(async (session) => {
      const requestDoc = await StockRequest.findOne({
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
      }).session(session);
      if (!requestDoc || requestDoc.status !== "approved") {
        throw Object.assign(new Error("Only approved requests can be issued."), { statusCode: 409 });
      }
      const stock = await ProductStock.findOne({
        ...(tenantId ? { tenantId } : {}),
        product: requestDoc.product,
        warehouse: req.body.warehouse,
        ...(req.body.location ? { location: req.body.location } : {}),
        status: "active",
        availableQuantity: { $gte: requestDoc.requestedQuantity },
      })
        .sort({ availableQuantity: -1 })
        .session(session);
      if (!stock) {
        throw Object.assign(new Error("The selected warehouse does not contain sufficient available stock."), {
          statusCode: 409,
        });
      }
      const preference = await InventoryPreference.findOne({
        ...(tenantId ? { tenantId } : {}),
        key: "default",
      }).session(session);
      const method = preference?.stockIssueMethod || "fifo";
      const product = await Product.findOne({
        _id: requestDoc.product,
        ...(tenantId ? { tenantId } : {}),
      }).session(session);
      const allocations = [];
      if (product.trackingType !== "none") {
        let needed = requestDoc.requestedQuantity;
        const tracks = await InventoryTracking.find({
          ...(tenantId ? { tenantId } : {}),
          product: product._id,
          warehouse: stock.warehouse,
          location: stock.location,
          qualityState: "released",
          status: "active",
          usableQuantity: { $gt: 0 },
        })
          .sort({ arrivalDate: method === "fifo" ? 1 : -1, _id: method === "fifo" ? 1 : -1 })
          .session(session);
        for (const track of tracks) {
          if (needed <= 0) break;
          const used = Math.min(needed, track.usableQuantity);
          track.remainingQuantity = round(track.remainingQuantity - used);
          track.usableQuantity = round(track.usableQuantity - used);
          if (track.usableQuantity === 0) track.status = "depleted";
          track.updatedBy = req.user._id;
          await track.save(sessionOpt(session));
          allocations.push({ tracking: track._id, trackingReference: track.trackingReference, quantity: used });
          needed = round(needed - used);
        }
        if (needed > 0) {
          throw Object.assign(new Error("Eligible tracking records cannot fulfill the issue quantity."), {
            statusCode: 409,
          });
        }
      }

      const issueRef = reference("ISS", product.sku);
      const movement = await postStockMovement({
        tenantId: tenantId || stock.tenantId,
        movementType: "production_issue",
        reference: issueRef,
        sourceType: "stock_request",
        sourceId: requestDoc._id,
        reason: "Internal stock consumption",
        lines: [
          {
            product: product._id,
            effect: "out",
            sourceWarehouse: stock.warehouse,
            sourceLocation: stock.location,
            quantity: requestDoc.requestedQuantity,
            requestedUnitCost: stock.averageCost,
          },
        ],
        userId: req.user._id,
        session,
      });

      const [issue] = await StockIssue.create(
        [
          {
            ...(tenantId ? { tenantId } : {}),
            issueReference: issueRef,
            request: requestDoc._id,
            product: product._id,
            quantity: requestDoc.requestedQuantity,
            warehouse: stock.warehouse,
            location: stock.location,
            requester: requestDoc.requester,
            department: requestDoc.department,
            approver: requestDoc.approver,
            issuedBy: req.user._id,
            issueMethod: method,
            allocations,
            movement: movement._id,
            journalEntry: movement.journalEntry || null,
            costAmount: movement.lines?.[0]?.totalCost || (requestDoc.requestedQuantity * num(stock.averageCost)),
          },
        ],
        sessionOpt(session)
      );

      await ConsumptionHistory.create(
        [
          {
            ...(tenantId ? { tenantId } : {}),
            issue: issue._id,
            issueReference: issue.issueReference,
            issueDate: issue.issueDate,
            product: product._id,
            quantity: issue.quantity,
            employee: requestDoc.requester,
            department: requestDoc.department,
            warehouse: stock.warehouse,
            location: stock.location,
            allocations,
            approver: requestDoc.approver,
            issuedBy: req.user._id,
          },
        ],
        sessionOpt(session)
      );

      requestDoc.status = "issued";
      requestDoc.issue = issue._id;
      requestDoc.updatedBy = req.user._id;
      await requestDoc.save(sessionOpt(session));
      await writeAudit({
        session,
        actorId: req.user._id,
        action: "issue",
        entityType: "StockRequest",
        entityId: requestDoc._id,
        after: requestDoc.toObject(),
        meta: getReqMeta(req),
      });
      return issue;
    });
    return res.status(201).json(result);
  } catch (e) {
    return fail(res, e, "Failed to issue stock.");
  }
};

export const listTracking = async (req, res) => {
  const tenantId = req.tenantId;
  const { limit, skip } = page(req.query);
  const filter = tenantId ? { tenantId } : {};
  if (req.query.type && req.query.type !== "all") {
    filter.trackingType = req.query.type === "expiry" ? { $in: ["expiry", "batch_expiry"] } : req.query.type;
  }
  if (req.query.state && req.query.state !== "all") filter.qualityState = req.query.state;
  const [items, total] = await Promise.all([
    InventoryTracking.find(filter)
      .populate("product", "name sku imageUrl")
      .populate("warehouse location", "name code")
      .sort({ arrivalDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InventoryTracking.countDocuments(filter),
  ]);
  res.json({ items, total, limit, skip });
};

export const updateTrackingState = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const state = req.body.qualityState;
    if (!["released", "quarantine", "removed"].includes(state)) {
      return res.status(400).json({ message: "Invalid tracking quality state." });
    }
    const result = await runMongoTransaction(async (session) => {
      const track = await InventoryTracking.findOne({
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
      }).session(session);
      if (!track) throw Object.assign(new Error("Tracking record not found."), { statusCode: 404 });
      if (track.qualityState === state) return track;
      const quantity = track.usableQuantity;
      let movement = null;
      if (state === "removed" && quantity > 0) {
        movement = await postStockMovement({
          tenantId: tenantId || track.tenantId,
          movementType: "other",
          reference: reference("REM"),
          sourceType: "tracking",
          sourceId: track._id,
          reason: clean(req.body.reason) || "Tracking removal",
          lines: [
            {
              product: track.product,
              effect: track.qualityState === "quarantine" ? "out_quarantine" : "out",
              sourceWarehouse: track.warehouse,
              sourceLocation: track.location,
              quantity,
              requestedUnitCost: track.unitCost,
            },
          ],
          userId: req.user._id,
          session,
        });
        await InventoryLoss.create(
          [
            {
              ...(tenantId ? { tenantId } : {}),
              lossReference: reference("LOS"),
              product: track.product,
              warehouse: track.warehouse,
              location: track.location,
              quantity,
              unitCost: track.unitCost,
              lossValue: quantity * track.unitCost,
              lossType: "tracking_removal",
              reason: clean(req.body.reason),
              sourceType: "tracking",
              sourceId: track._id,
              movement: movement._id,
              journalEntry: movement.journalEntry || null,
              recordedBy: req.user._id,
            },
          ],
          sessionOpt(session)
        );
        track.remainingQuantity = 0;
        track.usableQuantity = 0;
        track.status = "removed";
      } else if (quantity > 0) {
        const effect = state === "quarantine" ? "quarantine" : "release_quarantine";
        movement = await postStockMovement({
          tenantId: tenantId || track.tenantId,
          movementType: state === "quarantine" ? "quarantine" : "release_quarantine",
          reference: reference("TRS"),
          sourceType: "tracking",
          sourceId: track._id,
          reason: clean(req.body.reason),
          lines: [
            {
              product: track.product,
              effect,
              sourceWarehouse: track.warehouse,
              sourceLocation: track.location,
              quantity,
            },
          ],
          userId: req.user._id,
          session,
        });
      }
      track.qualityState = state;
      track.updatedBy = req.user._id;
      await track.save(sessionOpt(session));
      return track;
    });
    return res.json(result);
  } catch (e) {
    return fail(res, e, "Failed to update tracking state.");
  }
};

export const listConsumption = async (req, res) => {
  const tenantId = req.tenantId;
  const { limit, skip } = page(req.query);
  const filter = tenantId ? { tenantId } : {};
  if (isId(req.query.product)) filter.product = req.query.product;
  if (isId(req.query.employee)) filter.employee = req.query.employee;
  if (isId(req.query.department)) filter.department = req.query.department;
  const [items, total] = await Promise.all([
    ConsumptionHistory.find(filter)
      .populate("product", "name sku")
      .populate("employee issuedBy approver", "name employeeId")
      .populate("department", "name")
      .populate("warehouse location", "name code")
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ConsumptionHistory.countDocuments(filter),
  ]);
  res.json({ items, total, limit, skip });
};

export const listLosses = async (req, res) => {
  const tenantId = req.tenantId;
  const { limit, skip } = page(req.query);
  const filter = tenantId ? { tenantId } : {};
  if (req.query.lossType && req.query.lossType !== "all") filter.lossType = req.query.lossType;
  const [items, total, summary] = await Promise.all([
    InventoryLoss.find(filter)
      .populate("product", "name sku")
      .populate("warehouse location", "name code")
      .sort({ lossDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InventoryLoss.countDocuments(filter),
    InventoryLoss.aggregate([
      { $match: filter },
      { $group: { _id: "$lossType", quantity: { $sum: "$quantity" }, value: { $sum: "$lossValue" }, count: { $sum: 1 } } },
    ]),
  ]);
  res.json({ items, total, summary, limit, skip });
};

export const listInspections = async (req, res) => {
  const tenantId = req.tenantId;
  const { limit, skip } = page(req.query);
  const filter = tenantId ? { tenantId } : {};
  if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
  const [items, total] = await Promise.all([
    StockInspection.find(filter)
      .populate("product", "name sku")
      .populate("warehouse location", "name code")
      .populate("tracking", "trackingReference trackingType")
      .populate("requestedBy inspector", "name employeeId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockInspection.countDocuments(filter),
  ]);
  res.json({ items, total, limit, skip });
};

export const createInspection = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const stock = await ProductStock.findOne({
      ...(tenantId ? { tenantId } : {}),
      product: req.body.product,
      warehouse: req.body.warehouse,
      location: req.body.location || null,
      status: "active",
    }).populate("product", "sku");
    if (!stock) return res.status(404).json({ message: "Inventory position not found." });
    const item = await StockInspection.create({
      ...(tenantId ? { tenantId } : {}),
      inspectionReference: reference("SIQ", stock.product.sku),
      product: stock.product._id,
      warehouse: stock.warehouse,
      location: stock.location,
      tracking: isId(req.body.tracking) ? req.body.tracking : null,
      previousQuantity: stock.onHandQuantity,
      remainingQuantity: stock.onHandQuantity,
      requestSource: req.body.requestSource || "inventory_item",
      requestedBy: req.user._id,
    });
    return res.status(201).json(item);
  } catch (e) {
    return fail(res, e, "Failed to create inspection.");
  }
};

export const completeInspection = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const result = await runMongoTransaction(async (session) => {
      const item = await StockInspection.findOne({
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
      }).session(session);
      if (!item || !["waiting", "processing"].includes(item.status)) {
        throw Object.assign(new Error("Inspection is not open."), { statusCode: 409 });
      }
      const inspected = round(req.body.inspectedQuantity),
        damaged = round(req.body.damagedQuantity);
      if (inspected < 0 || damaged < 0 || damaged > inspected || inspected > item.previousQuantity) {
        throw Object.assign(new Error("Inspection quantities are invalid."), { statusCode: 400 });
      }
      let movement = null,
        loss = null;
      if (damaged > 0) {
        const stock = await ProductStock.findOne({
          ...(tenantId ? { tenantId } : {}),
          product: item.product,
          warehouse: item.warehouse,
          location: item.location,
        }).session(session);
        movement = await postStockMovement({
          tenantId: tenantId || item.tenantId,
          movementType: "stock_adjustment",
          reference: item.inspectionReference,
          sourceType: "stock_inspection",
          sourceId: item._id,
          reason: "Inspection damage",
          lines: [
            {
              product: item.product,
              effect: "out",
              sourceWarehouse: item.warehouse,
              sourceLocation: item.location,
              quantity: damaged,
              requestedUnitCost: stock?.averageCost || 0,
            },
          ],
          userId: req.user._id,
          session,
        });
        [loss] = await InventoryLoss.create(
          [
            {
              ...(tenantId ? { tenantId } : {}),
              lossReference: reference("LOS"),
              product: item.product,
              warehouse: item.warehouse,
              location: item.location,
              quantity: damaged,
              unitCost: stock?.averageCost || 0,
              lossValue: damaged * num(stock?.averageCost),
              lossType: "inspection",
              reason: clean(req.body.note),
              sourceType: "stock_inspection",
              sourceId: item._id,
              movement: movement._id,
              journalEntry: movement.journalEntry || null,
              recordedBy: req.user._id,
            },
          ],
          sessionOpt(session)
        );
        if (item.tracking) {
          const tracking = await InventoryTracking.findOne({
            _id: item.tracking,
            ...(tenantId ? { tenantId } : {}),
          }).session(session);
          if (tracking) {
            tracking.remainingQuantity = Math.max(0, round(tracking.remainingQuantity - damaged));
            tracking.usableQuantity = Math.max(0, round(tracking.usableQuantity - damaged));
            await tracking.save(sessionOpt(session));
          }
        }
      }
      item.inspectedQuantity = inspected;
      item.damagedQuantity = damaged;
      item.remainingQuantity = round(item.previousQuantity - damaged);
      item.result = req.body.result || (damaged > 0 ? "damaged" : "accepted");
      item.note = clean(req.body.note);
      item.status = "completed";
      item.inspector = req.user._id;
      item.completedAt = new Date();
      item.movement = movement?._id || null;
      item.loss = loss?._id || null;
      await item.save(sessionOpt(session));

      if (item.schedule) {
        const schedule = await WarehouseCheck.findOne({
          _id: item.schedule,
          ...(tenantId ? { tenantId } : {}),
        }).session(session);
        if (schedule) {
          const [positions, inspections] = await Promise.all([
            ProductStock.find({
              ...(tenantId ? { tenantId } : {}),
              warehouse: schedule.warehouse,
              status: "active",
              onHandQuantity: { $gt: 0 },
            })
              .select("product location")
              .session(session)
              .lean(),
            StockInspection.find({
              ...(tenantId ? { tenantId } : {}),
              schedule: schedule._id,
              scheduleCycle: schedule.cycleNumber,
              status: "completed",
            })
              .select("product location status")
              .session(session)
              .lean(),
          ]);
          const allCyclePositions = [...positions, ...inspections].filter(
            (position, index, source) => source.findIndex((candidate) => positionKey(candidate) === positionKey(position)) === index
          );
          Object.assign(
            schedule,
            isWarehouseCycleComplete(allCyclePositions, inspections)
              ? advanceWarehouseCheckCycle(schedule, item.completedAt)
              : { status: "waiting", queuedInspections: [] }
          );
          schedule.updatedBy = req.user._id;
          await schedule.save(sessionOpt(session));
        }
      }
      return item;
    });
    return res.json(result);
  } catch (e) {
    return fail(res, e, "Failed to complete inspection.");
  }
};

async function dispatchScheduleInspection(schedule, userId, tenantId) {
  if (!schedule || schedule.status === "paused") {
    throw Object.assign(new Error("No active warehouse schedule is available."), { statusCode: 409 });
  }
  const open = await StockInspection.findOne({
    ...(tenantId ? { tenantId } : {}),
    schedule: schedule._id,
    scheduleCycle: schedule.cycleNumber,
    status: { $in: ["waiting", "processing"] },
  })
    .populate("product", "name sku")
    .populate("warehouse location", "name code");
  if (open) return open;

  const positions = await ProductStock.find({
    ...(tenantId ? { tenantId } : {}),
    warehouse: schedule.warehouse,
    status: "active",
    onHandQuantity: { $gt: 0 },
  })
    .populate("product", "name sku")
    .sort({ updatedAt: 1, _id: 1 })
    .lean();
  if (!positions.length) {
    throw Object.assign(new Error("This warehouse has no active stock positions to inspect."), { statusCode: 409 });
  }
  const prior = await StockInspection.find({
    ...(tenantId ? { tenantId } : {}),
    schedule: schedule._id,
    scheduleCycle: schedule.cycleNumber,
    status: { $ne: "cancelled" },
  })
    .select("product location status")
    .lean();
  const dispatched = new Set(prior.map(positionKey));
  const position = positions.find((candidate) => !dispatched.has(positionKey(candidate)));
  if (!position) {
    throw Object.assign(new Error("Every item in this warehouse cycle has already been dispatched."), { statusCode: 409 });
  }
  const item = await StockInspection.create({
    ...(tenantId ? { tenantId } : {}),
    inspectionReference: reference("SIQ", position.product?.sku),
    product: position.product?._id || position.product,
    warehouse: position.warehouse,
    location: position.location || null,
    previousQuantity: position.onHandQuantity,
    remainingQuantity: position.onHandQuantity,
    requestSource: "warehouse_schedule",
    requestedBy: userId,
    schedule: schedule._id,
    scheduleCycle: schedule.cycleNumber,
  });
  schedule.status = "processing";
  schedule.queuedInspections = [item._id];
  schedule.updatedBy = userId;
  await schedule.save();
  return StockInspection.findById(item._id)
    .populate("product", "name sku")
    .populate("warehouse location", "name code");
}

export const listWarehouseChecks = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const activeWarehouses = await Warehouse.find({
      ...(tenantId ? { tenantId } : {}),
      status: "active",
    })
      .select("_id")
      .lean();
    const existing = await WarehouseCheck.find({
      ...(tenantId ? { tenantId } : {}),
      warehouse: { $in: activeWarehouses.map((item) => item._id) },
    })
      .select("warehouse")
      .lean();
    const missing = buildMissingWarehouseSchedules(activeWarehouses, existing, req.user._id, new Date(), tenantId);
    if (missing.length) {
      await WarehouseCheck.bulkWrite(
        missing.map((item) => ({
          updateOne: {
            filter: {
              ...(tenantId ? { tenantId } : {}),
              warehouse: item.warehouse,
            },
            update: { $setOnInsert: item },
            upsert: true,
          },
        }))
      );
    }
    const items = await WarehouseCheck.find({
      ...(tenantId ? { tenantId } : {}),
      warehouse: { $in: activeWarehouses.map((item) => item._id) },
    })
      .populate("warehouse", "name code")
      .sort({ nextInspectionDate: 1 })
      .lean();
    const scheduleIds = items.map((item) => item._id);
    const [queue, activityRows] = await Promise.all([
      StockInspection.find({
        ...(tenantId ? { tenantId } : {}),
        schedule: { $in: scheduleIds },
        status: { $in: ["waiting", "processing"] },
      })
        .populate("product", "name sku")
        .populate("warehouse location", "name code")
        .sort({ createdAt: 1 })
        .lean(),
      StockInspection.aggregate([
        {
          $match: {
            ...(tenantId ? { tenantId } : {}),
            schedule: { $in: scheduleIds },
          },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);
    const activity = Object.fromEntries(activityRows.map((row) => [row._id, row.count]));
    return res.json({ items, queue, activity });
  } catch (e) {
    return fail(res, e, "Failed to load warehouse checks.");
  }
};

export const createWarehouseCheck = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const days = Number(req.body.frequencyDays);
    const next = req.body.nextInspectionDate ? new Date(req.body.nextInspectionDate) : new Date(Date.now() + days * 86400000);
    const item = await WarehouseCheck.create({
      ...(tenantId ? { tenantId } : {}),
      warehouse: req.body.warehouse,
      frequencyDays: days,
      inspectionMode: req.body.inspectionMode,
      nextInspectionDate: next,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    return res.status(201).json(item);
  } catch (e) {
    return fail(res, e, "Failed to create warehouse check.");
  }
};

export const updateWarehouseCheck = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const days = Number(req.body.frequencyDays);
    if (!Number.isFinite(days) || days < 1 || !["full_warehouse", "item_by_item"].includes(req.body.inspectionMode)) {
      return res.status(400).json({ message: "Checking mode and a positive frequency are required." });
    }
    const item = await WarehouseCheck.findOneAndUpdate(
      { _id: req.params.id, ...(tenantId ? { tenantId } : {}) },
      { $set: { frequencyDays: days, inspectionMode: req.body.inspectionMode, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    ).populate("warehouse", "name code");
    if (!item) return res.status(404).json({ message: "Warehouse schedule not found." });
    return res.json(item);
  } catch (e) {
    return fail(res, e, "Failed to update warehouse check.");
  }
};

export const setWarehouseCheckStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const status = req.body.status;
    if (!["waiting", "paused"].includes(status)) {
      return res.status(400).json({ message: "Warehouse schedules can only be paused or resumed here." });
    }
    const item = await WarehouseCheck.findOne({ _id: req.params.id, ...(tenantId ? { tenantId } : {}) });
    if (!item) return res.status(404).json({ message: "Warehouse schedule not found." });
    if (status === "paused") {
      await StockInspection.updateMany(
        {
          ...(tenantId ? { tenantId } : {}),
          schedule: item._id,
          scheduleCycle: item.cycleNumber,
          status: { $in: ["waiting", "processing"] },
        },
        { $set: { status: "cancelled" } }
      );
      item.status = "paused";
      item.queuedInspections = [];
    } else {
      item.status = "waiting";
      item.queuedInspections = [];
    }
    item.updatedBy = req.user._id;
    await item.save();
    const inspection = status === "waiting" ? await dispatchScheduleInspection(item, req.user._id, tenantId).catch(() => null) : null;
    return res.json({ item, inspection });
  } catch (e) {
    return fail(res, e, "Failed to update warehouse check.");
  }
};

export const sendNextWarehouseCheckItem = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const activeWarehouseIds = await Warehouse.find({
      ...(tenantId ? { tenantId } : {}),
      status: "active",
    }).distinct("_id");
    const schedules = await WarehouseCheck.find({
      ...(tenantId ? { tenantId } : {}),
      warehouse: { $in: activeWarehouseIds },
      status: { $in: ["waiting", "processing"] },
    })
      .sort({ nextInspectionDate: 1 })
      .lean();
    const selected = pickNextWarehouseSchedule(schedules);
    if (!selected) return res.status(409).json({ message: "No active warehouse schedule is available." });
    const schedule = await WarehouseCheck.findOne({ _id: selected._id, ...(tenantId ? { tenantId } : {}) });
    const inspection = await dispatchScheduleInspection(schedule, req.user._id, tenantId);
    return res.status(201).json({ inspection });
  } catch (e) {
    return fail(res, e, "Failed to send the next warehouse item.");
  }
};

export const inventoryOverview = async (req, res) => {
  const tenantId = req.tenantId;
  const now = new Date();
  const pref = await InventoryPreference.findOne({
    ...(tenantId ? { tenantId } : {}),
    key: "default",
  }).lean();
  const threshold = new Date(Date.now() + num(pref?.nearExpiryAlertDays || 30) * 86400000);
  const matchTenant = tenantId ? { tenantId } : {};

  const [pendingInventory, pendingRequests, approvedRequests, inspections, nearExpiry, losses, consumption] = await Promise.all([
    PendingInventory.countDocuments({ ...matchTenant, status: { $in: ["pending", "partially_assigned"] } }),
    StockRequest.countDocuments({ ...matchTenant, status: "pending" }),
    StockRequest.countDocuments({ ...matchTenant, status: "approved" }),
    StockInspection.countDocuments({ ...matchTenant, status: { $in: ["waiting", "processing"] } }),
    InventoryTracking.countDocuments({ ...matchTenant, expiryDate: { $gte: now, $lte: threshold }, status: "active" }),
    InventoryLoss.aggregate([
      ...(tenantId ? [{ $match: { tenantId } }] : []),
      { $group: { _id: null, value: { $sum: "$lossValue" } } },
    ]),
    ConsumptionHistory.aggregate([
      { $match: { ...matchTenant, issueDate: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      { $group: { _id: null, quantity: { $sum: "$quantity" } } },
    ]),
  ]);
  res.json({
    pendingInventory,
    pendingRequests,
    approvedRequests,
    pendingInspections: inspections,
    nearExpiry,
    currentLossValue: num(losses[0]?.value),
    consumption30Days: num(consumption[0]?.quantity),
    preferences: pref,
  });
};
