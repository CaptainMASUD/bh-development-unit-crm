import mongoose from "mongoose";
import Product from "./product.model.js";
import Warehouse from "./warehouse.model.js";
import WarehouseLocation from "./warehouseLocation.model.js";
import ProductStock, { roundMoney, roundQuantity } from "./productStock.model.js";

const MOVEMENT_TYPES = [
  "opening_stock",
  "purchase_receipt",
  "purchase_return",
  "sales_issue",
  "sales_return",
  "warehouse_transfer",
  "stock_adjustment",
  "production_issue",
  "production_receipt",
  "reservation",
  "release_reservation",
  "quarantine",
  "release_quarantine",
  "incoming_commitment",
  "outgoing_commitment",
  "reversal",
  "other",
];

const MOVEMENT_STATUSES = ["draft", "posted", "reversed", "cancelled"];

const STOCK_EFFECTS = [
  "in",
  "out",
  "transfer",
  "reserve",
  "release",
  "quarantine",
  "release_quarantine",
  "in_quarantine",
  "out_quarantine",
  "incoming",
  "incoming_clear",
  "outgoing",
  "outgoing_clear",
];

const PHYSICAL_EFFECTS = new Set(["in", "out", "transfer", "in_quarantine", "out_quarantine"]);
const SOURCE_EFFECTS = new Set([
  "out",
  "transfer",
  "reserve",
  "release",
  "quarantine",
  "release_quarantine",
  "out_quarantine",
  "outgoing",
  "outgoing_clear",
]);
const DESTINATION_EFFECTS = new Set(["in", "transfer", "in_quarantine", "incoming", "incoming_clear"]);

const balanceSnapshotSchema = new mongoose.Schema(
  {
    onHandQuantity: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    quarantineQuantity: { type: Number, default: 0 },
    availableQuantity: { type: Number, default: 0 },
    incomingQuantity: { type: Number, default: 0 },
    outgoingQuantity: { type: Number, default: 0 },
    averageCost: { type: Number, default: 0 },
    inventoryValue: { type: Number, default: 0 },
    stockVersion: { type: Number, default: 0 },
  },
  { _id: false }
);

const stockMovementLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    effect: {
      type: String,
      enum: STOCK_EFFECTS,
      required: true,
    },
    sourceWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    sourceLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
    },
    destinationWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    destinationLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.000001,
    },
    requestedUnitCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    appliedUnitCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    appliedValue: {
      type: Number,
      default: 0,
    },
    lotNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    serialNumbers: {
      type: [String],
      default: [],
    },
    manufactureDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    sourceBalanceAfter: {
      type: balanceSnapshotSchema,
      default: null,
    },
    destinationBalanceAfter: {
      type: balanceSnapshotSchema,
      default: null,
    },
  },
  { _id: true }
);

const stockMovementSchema = new mongoose.Schema(
  {
    movementNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    movementDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    movementType: {
      type: String,
      enum: MOVEMENT_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: MOVEMENT_STATUSES,
      default: "draft",
      index: true,
    },
    reference: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 160,
      default: "",
    },
    sourceType: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 80,
      default: "manual",
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 12,
      default: "BDT",
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },
    lines: {
      type: [stockMovementLineSchema],
      validate: {
        validator: (lines) => Array.isArray(lines) && lines.length > 0 && lines.length <= 500,
        message: "A movement must contain between 1 and 500 lines.",
      },
    },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    sourceWarehouses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Warehouse" }],
    destinationWarehouses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Warehouse" }],
    lineCount: { type: Number, min: 0, default: 0 },
    totalQuantity: { type: Number, min: 0, default: 0 },
    totalValue: { type: Number, default: 0 },
    postedAt: { type: Date, default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancellationReason: { type: String, trim: true, maxlength: 1000, default: "" },
    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      default: null,
      index: true,
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: true,
  }
);

stockMovementSchema.index({ movementNo: 1 }, { unique: true });
stockMovementSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } },
  }
);
stockMovementSchema.index({ sourceType: 1, sourceId: 1, movementDate: -1 });
stockMovementSchema.index({ status: 1, movementDate: -1, _id: -1 });
stockMovementSchema.index({ movementType: 1, status: 1, movementDate: -1, _id: -1 });
stockMovementSchema.index({ products: 1, movementDate: -1, _id: -1 });
stockMovementSchema.index({ sourceWarehouses: 1, movementDate: -1, _id: -1 });
stockMovementSchema.index({ destinationWarehouses: 1, movementDate: -1, _id: -1 });
stockMovementSchema.index({ reference: 1, movementDate: -1 });
stockMovementSchema.index(
  { reversalOf: 1 },
  { unique: true, partialFilterExpression: { reversalOf: { $type: "objectId" } } }
);

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const idKey = (value) => String(value || "");
const positionKey = (product, warehouse, location = null) =>
  `${idKey(product)}:${idKey(warehouse)}:${location ? idKey(location) : "none"}`;

const uniqueObjectIds = (values = []) => {
  const seen = new Set();
  return values.filter(Boolean).filter((value) => {
    const key = idKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeSerialNumbers = (values = []) =>
  uniqueObjectIds(
    (Array.isArray(values) ? values : [])
      .map((value) => clean(value).toUpperCase())
      .filter(Boolean)
  );

const normalizeMovementLine = (line) => {
  line.effect = clean(line.effect).toLowerCase();
  line.quantity = roundQuantity(line.quantity);
  line.requestedUnitCost = roundMoney(line.requestedUnitCost);
  line.appliedUnitCost = roundMoney(line.appliedUnitCost);
  line.appliedValue = roundMoney(line.appliedValue);
  line.lotNumber = clean(line.lotNumber).toUpperCase();
  line.serialNumbers = normalizeSerialNumbers(line.serialNumbers);
  line.note = clean(line.note);
  return line;
};

const movementNumber = (doc) => {
  const date = new Date(doc.movementDate || Date.now());
  const datePart = [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("");
  return `SM-${datePart}-${String(doc._id).slice(-10).toUpperCase()}`;
};

const stockSnapshot = (stock) => ({
  onHandQuantity: roundQuantity(stock?.onHandQuantity),
  reservedQuantity: roundQuantity(stock?.reservedQuantity),
  quarantineQuantity: roundQuantity(stock?.quarantineQuantity),
  availableQuantity: roundQuantity(stock?.availableQuantity),
  incomingQuantity: roundQuantity(stock?.incomingQuantity),
  outgoingQuantity: roundQuantity(stock?.outgoingQuantity),
  averageCost: roundMoney(stock?.averageCost),
  inventoryValue: roundMoney(stock?.inventoryValue),
  stockVersion: Number(stock?.stockVersion || 0),
});

const weightedAverageCost = ({ currentQuantity, currentCost, incomingQuantity, incomingCost }) => {
  const currentQty = Math.max(Number(currentQuantity || 0), 0);
  const incomingQty = Math.max(Number(incomingQuantity || 0), 0);
  const nextQuantity = currentQty + incomingQty;
  if (nextQuantity <= 0) return roundMoney(incomingCost || currentCost || 0);
  return roundMoney(
    (currentQty * Number(currentCost || 0) + incomingQty * Number(incomingCost || 0)) /
      nextQuantity
  );
};

const reverseEffect = (effect) => {
  const map = {
    in: "out",
    out: "in",
    transfer: "transfer",
    reserve: "release",
    release: "reserve",
    quarantine: "release_quarantine",
    release_quarantine: "quarantine",
    in_quarantine: "out_quarantine",
    out_quarantine: "in_quarantine",
    incoming: "incoming_clear",
    incoming_clear: "incoming",
    outgoing: "outgoing_clear",
    outgoing_clear: "outgoing",
  };
  return map[effect];
};

const buildReversalLine = (line) => {
  const effect = reverseEffect(line.effect);
  let sourceWarehouse = line.sourceWarehouse || null;
  let sourceLocation = line.sourceLocation || null;
  let destinationWarehouse = line.destinationWarehouse || null;
  let destinationLocation = line.destinationLocation || null;

  if (["in", "in_quarantine"].includes(line.effect)) {
    sourceWarehouse = line.destinationWarehouse;
    sourceLocation = line.destinationLocation;
    destinationWarehouse = null;
    destinationLocation = null;
  } else if (["out", "out_quarantine"].includes(line.effect)) {
    sourceWarehouse = null;
    sourceLocation = null;
    destinationWarehouse = line.sourceWarehouse;
    destinationLocation = line.sourceLocation;
  } else if (line.effect === "transfer") {
    sourceWarehouse = line.destinationWarehouse;
    sourceLocation = line.destinationLocation;
    destinationWarehouse = line.sourceWarehouse;
    destinationLocation = line.sourceLocation;
  }

  return {
    product: line.product,
    effect,
    sourceWarehouse,
    sourceLocation,
    destinationWarehouse,
    destinationLocation,
    quantity: line.quantity,
    requestedUnitCost: line.appliedUnitCost || line.requestedUnitCost || 0,
    lotNumber: line.lotNumber || "",
    serialNumbers: line.serialNumbers || [],
    manufactureDate: line.manufactureDate || null,
    expiryDate: line.expiryDate || null,
    note: `Reversal of movement line ${line._id}`,
  };
};

stockMovementSchema.pre("validate", function (next) {
  this.movementDate = this.movementDate || new Date();
  this.movementNo = clean(this.movementNo || movementNumber(this)).toUpperCase();
  this.movementType = clean(this.movementType).toLowerCase();
  this.status = clean(this.status || "draft").toLowerCase();
  this.reference = clean(this.reference).toUpperCase();
  this.sourceType = clean(this.sourceType || "manual").toLowerCase();
  this.idempotencyKey = clean(this.idempotencyKey);
  this.currency = clean(this.currency || "BDT").toUpperCase();
  this.reason = clean(this.reason);
  this.notes = clean(this.notes);
  this.cancellationReason = clean(this.cancellationReason);

  for (const line of this.lines || []) normalizeMovementLine(line);

  this.products = uniqueObjectIds((this.lines || []).map((line) => line.product));
  this.sourceWarehouses = uniqueObjectIds((this.lines || []).map((line) => line.sourceWarehouse));
  this.destinationWarehouses = uniqueObjectIds((this.lines || []).map((line) => line.destinationWarehouse));
  this.lineCount = this.lines?.length || 0;
  this.totalQuantity = roundQuantity((this.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0), 0));
  this.totalValue = roundMoney((this.lines || []).reduce((sum, line) => sum + Number(line.appliedValue || 0), 0));

  if (this.status === "posted" && !this.postedAt) this.invalidate("postedAt", "A posted movement requires a posting timestamp.");
  if (this.reversalOf && this.movementType !== "reversal") this.movementType = "reversal";

  next();
});

stockMovementSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = update.$set || update;
  if (patch.movementNo !== undefined) patch.movementNo = clean(patch.movementNo).toUpperCase();
  if (patch.movementType !== undefined) patch.movementType = clean(patch.movementType).toLowerCase();
  if (patch.status !== undefined) patch.status = clean(patch.status).toLowerCase();
  if (patch.reference !== undefined) patch.reference = clean(patch.reference).toUpperCase();
  if (patch.sourceType !== undefined) patch.sourceType = clean(patch.sourceType).toLowerCase();
  if (patch.idempotencyKey !== undefined) patch.idempotencyKey = clean(patch.idempotencyKey);
  if (patch.currency !== undefined) patch.currency = clean(patch.currency || "BDT").toUpperCase();
  if (patch.reason !== undefined) patch.reason = clean(patch.reason);
  if (patch.notes !== undefined) patch.notes = clean(patch.notes);
  if (patch.cancellationReason !== undefined) patch.cancellationReason = clean(patch.cancellationReason);
  if (update.$set) update.$set = patch;
  this.setUpdate(update);
  next();
});

const validateLineShape = (line, index) => {
  const label = `Line ${index + 1}`;
  if (!isId(line.product)) throw Object.assign(new Error(`${label}: select a valid product.`), { statusCode: 400 });
  if (!STOCK_EFFECTS.includes(clean(line.effect).toLowerCase())) {
    throw Object.assign(new Error(`${label}: stock effect is invalid.`), { statusCode: 400 });
  }
  const quantity = Number(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw Object.assign(new Error(`${label}: quantity must be greater than zero.`), { statusCode: 400 });
  }
  const effect = clean(line.effect).toLowerCase();
  if (SOURCE_EFFECTS.has(effect) && !isId(line.sourceWarehouse)) {
    throw Object.assign(new Error(`${label}: source warehouse is required.`), { statusCode: 400 });
  }
  if (DESTINATION_EFFECTS.has(effect) && !isId(line.destinationWarehouse)) {
    throw Object.assign(new Error(`${label}: destination warehouse is required.`), { statusCode: 400 });
  }
  if (line.sourceLocation && !isId(line.sourceLocation)) {
    throw Object.assign(new Error(`${label}: source location is invalid.`), { statusCode: 400 });
  }
  if (line.destinationLocation && !isId(line.destinationLocation)) {
    throw Object.assign(new Error(`${label}: destination location is invalid.`), { statusCode: 400 });
  }
  if (
    effect === "transfer" &&
    positionKey(line.product, line.sourceWarehouse, line.sourceLocation) ===
      positionKey(line.product, line.destinationWarehouse, line.destinationLocation)
  ) {
    throw Object.assign(new Error(`${label}: source and destination stock positions must be different.`), { statusCode: 409 });
  }
};

stockMovementSchema.statics.validateDraftLines = async function (lines, { session = null } = {}) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 500) {
    throw Object.assign(new Error("A movement must contain between 1 and 500 lines."), { statusCode: 400 });
  }
  lines.forEach(validateLineShape);

  const productIds = uniqueObjectIds(lines.map((line) => line.product));
  const warehouseIds = uniqueObjectIds(
    lines.flatMap((line) => [line.sourceWarehouse, line.destinationWarehouse])
  );
  const locationIds = uniqueObjectIds(
    lines.flatMap((line) => [line.sourceLocation, line.destinationLocation])
  );

  const productQuery = Product.find({ _id: { $in: productIds } })
    .select("name sku productType trackInventory trackingType purchasePrice allowNegativeStock status")
    .lean();
  const warehouseQuery = Warehouse.find({ _id: { $in: warehouseIds } })
    .select("name code allowNegativeStock status")
    .lean();
  const locationQuery = locationIds.length
    ? WarehouseLocation.find({ _id: { $in: locationIds } })
        .select("warehouse name code status isQuarantine")
        .lean()
    : Promise.resolve([]);

  if (session) {
    productQuery.session(session);
    warehouseQuery.session(session);
    if (locationIds.length) locationQuery.session(session);
  }

  const [products, warehouses, locations] = await Promise.all([productQuery, warehouseQuery, locationQuery]);
  const productMap = new Map(products.map((item) => [idKey(item._id), item]));
  const warehouseMap = new Map(warehouses.map((item) => [idKey(item._id), item]));
  const locationMap = new Map(locations.map((item) => [idKey(item._id), item]));

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const label = `Line ${index + 1}`;
    const product = productMap.get(idKey(line.product));
    if (!product) throw Object.assign(new Error(`${label}: product was not found.`), { statusCode: 404 });
    if (product.status !== "active" || product.productType !== "inventory" || product.trackInventory !== true) {
      throw Object.assign(new Error(`${label}: product must be active and inventory-tracked.`), { statusCode: 409 });
    }

    for (const [warehouseField, locationField] of [
      ["sourceWarehouse", "sourceLocation"],
      ["destinationWarehouse", "destinationLocation"],
    ]) {
      const warehouseId = line[warehouseField];
      const locationId = line[locationField];
      if (!warehouseId) continue;
      const warehouse = warehouseMap.get(idKey(warehouseId));
      if (!warehouse) throw Object.assign(new Error(`${label}: warehouse was not found.`), { statusCode: 404 });
      if (warehouse.status !== "active") {
        throw Object.assign(new Error(`${label}: warehouse must be active.`), { statusCode: 409 });
      }
      if (locationId) {
        const location = locationMap.get(idKey(locationId));
        if (!location) throw Object.assign(new Error(`${label}: warehouse location was not found.`), { statusCode: 404 });
        if (location.status !== "active") {
          throw Object.assign(new Error(`${label}: warehouse location must be active.`), { statusCode: 409 });
        }
        if (idKey(location.warehouse) !== idKey(warehouseId)) {
          throw Object.assign(new Error(`${label}: location does not belong to its selected warehouse.`), { statusCode: 409 });
        }
      }
    }

    if (PHYSICAL_EFFECTS.has(clean(line.effect).toLowerCase())) {
      const quantity = roundQuantity(line.quantity);
      if (product.trackingType === "batch" && !clean(line.lotNumber)) {
        throw Object.assign(new Error(`${label}: lot number is required for this batch-tracked product.`), { statusCode: 400 });
      }
      if (product.trackingType === "serial") {
        if (!Number.isInteger(quantity)) {
          throw Object.assign(new Error(`${label}: serial-tracked product quantity must be a whole number.`), { statusCode: 400 });
        }
        const serials = normalizeSerialNumbers(line.serialNumbers);
        if (serials.length !== quantity) {
          throw Object.assign(new Error(`${label}: provide one unique serial number for each unit.`), { statusCode: 400 });
        }
      }
    }
  }

  return { productMap, warehouseMap, locationMap };
};

const loadPosition = async ({ product, warehouse, location = null, session }) =>
  ProductStock.findOne({ product, warehouse, location: location || null })
    .select(
      "onHandQuantity reservedQuantity quarantineQuantity availableQuantity incomingQuantity outgoingQuantity averageCost inventoryValue stockVersion status"
    )
    .session(session);

const applyDelta = async ({
  product,
  warehouse,
  location = null,
  delta,
  averageCost,
  allowNegativeStock,
  movementDate,
  userId,
  session,
}) =>
  ProductStock.applyQuantityDelta({
    product,
    warehouse,
    location,
    onHandDelta: delta.onHand || 0,
    reservedDelta: delta.reserved || 0,
    quarantineDelta: delta.quarantine || 0,
    incomingDelta: delta.incoming || 0,
    outgoingDelta: delta.outgoing || 0,
    averageCost,
    allowNegativeStock,
    movementDate,
    userId,
    session,
  });

stockMovementSchema.statics.postMovementDocument = async function ({ movementId, userId = null, session }) {
  if (!session) throw Object.assign(new Error("Stock posting requires a database transaction."), { statusCode: 500 });
  if (!isId(movementId)) throw Object.assign(new Error("Invalid stock movement ID."), { statusCode: 400 });

  const movement = await this.findById(movementId).session(session);
  if (!movement) throw Object.assign(new Error("Stock movement was not found."), { statusCode: 404 });
  if (movement.status === "posted") return movement;
  if (movement.status !== "draft") {
    throw Object.assign(new Error("Only a draft stock movement can be posted."), { statusCode: 409 });
  }

  const { productMap, warehouseMap, locationMap } = await this.validateDraftLines(movement.lines, { session });
  let movementValue = 0;

  for (const line of movement.lines) {
    const effect = clean(line.effect).toLowerCase();
    const quantity = roundQuantity(line.quantity);
    const product = productMap.get(idKey(line.product));
    const sourceWarehouse = line.sourceWarehouse ? warehouseMap.get(idKey(line.sourceWarehouse)) : null;
    const destinationWarehouse = line.destinationWarehouse
      ? warehouseMap.get(idKey(line.destinationWarehouse))
      : null;
    const sourceLocation = line.sourceLocation ? locationMap.get(idKey(line.sourceLocation)) : null;
    const destinationLocation = line.destinationLocation
      ? locationMap.get(idKey(line.destinationLocation))
      : null;

    let appliedUnitCost = roundMoney(line.requestedUnitCost || product.purchasePrice || 0);
    let sourceAfter = null;
    let destinationAfter = null;

    if (["out", "out_quarantine", "transfer"].includes(effect)) {
      const sourceStock = await loadPosition({
        product: line.product,
        warehouse: line.sourceWarehouse,
        location: line.sourceLocation,
        session,
      });
      appliedUnitCost = roundMoney(sourceStock?.averageCost || line.requestedUnitCost || product.purchasePrice || 0);
      const sourceIsQuarantine = effect === "out_quarantine" || sourceLocation?.isQuarantine === true;
      sourceAfter = await applyDelta({
        product: line.product,
        warehouse: line.sourceWarehouse,
        location: line.sourceLocation,
        delta: { onHand: -quantity, quarantine: sourceIsQuarantine ? -quantity : 0 },
        averageCost: sourceStock?.averageCost,
        allowNegativeStock: Boolean(product.allowNegativeStock || sourceWarehouse?.allowNegativeStock),
        movementDate: movement.movementDate,
        userId,
        session,
      });
    }

    if (["in", "in_quarantine"].includes(effect)) {
      const destinationStock = await loadPosition({
        product: line.product,
        warehouse: line.destinationWarehouse,
        location: line.destinationLocation,
        session,
      });
      const incomingCost = roundMoney(line.requestedUnitCost || destinationStock?.averageCost || product.purchasePrice || 0);
      const nextAverageCost = weightedAverageCost({
        currentQuantity: destinationStock?.onHandQuantity,
        currentCost: destinationStock?.averageCost,
        incomingQuantity: quantity,
        incomingCost,
      });
      appliedUnitCost = incomingCost;
      const destinationIsQuarantine = effect === "in_quarantine" || destinationLocation?.isQuarantine === true;
      destinationAfter = await applyDelta({
        product: line.product,
        warehouse: line.destinationWarehouse,
        location: line.destinationLocation,
        delta: { onHand: quantity, quarantine: destinationIsQuarantine ? quantity : 0 },
        averageCost: nextAverageCost,
        allowNegativeStock: true,
        movementDate: movement.movementDate,
        userId,
        session,
      });
    }

    if (effect === "transfer") {
      const destinationStock = await loadPosition({
        product: line.product,
        warehouse: line.destinationWarehouse,
        location: line.destinationLocation,
        session,
      });
      const nextAverageCost = weightedAverageCost({
        currentQuantity: destinationStock?.onHandQuantity,
        currentCost: destinationStock?.averageCost,
        incomingQuantity: quantity,
        incomingCost: appliedUnitCost,
      });
      destinationAfter = await applyDelta({
        product: line.product,
        warehouse: line.destinationWarehouse,
        location: line.destinationLocation,
        delta: {
          onHand: quantity,
          quarantine: destinationLocation?.isQuarantine === true ? quantity : 0,
        },
        averageCost: nextAverageCost,
        allowNegativeStock: true,
        movementDate: movement.movementDate,
        userId,
        session,
      });
    }

    if (["reserve", "release", "quarantine", "release_quarantine", "incoming", "incoming_clear", "outgoing", "outgoing_clear"].includes(effect)) {
      const warehouse = sourceWarehouse || destinationWarehouse;
      const warehouseId = line.sourceWarehouse || line.destinationWarehouse;
      const locationId = line.sourceLocation || line.destinationLocation;
      const current = await loadPosition({ product: line.product, warehouse: warehouseId, location: locationId, session });
      appliedUnitCost = roundMoney(current?.averageCost || line.requestedUnitCost || product.purchasePrice || 0);
      const delta = {};
      if (effect === "reserve") delta.reserved = quantity;
      if (effect === "release") delta.reserved = -quantity;
      if (effect === "quarantine") delta.quarantine = quantity;
      if (effect === "release_quarantine") delta.quarantine = -quantity;
      if (effect === "incoming") delta.incoming = quantity;
      if (effect === "incoming_clear") delta.incoming = -quantity;
      if (effect === "outgoing") delta.outgoing = quantity;
      if (effect === "outgoing_clear") delta.outgoing = -quantity;
      const updated = await applyDelta({
        product: line.product,
        warehouse: warehouseId,
        location: locationId,
        delta,
        averageCost: current?.averageCost,
        allowNegativeStock: Boolean(product.allowNegativeStock || warehouse?.allowNegativeStock),
        movementDate: movement.movementDate,
        userId,
        session,
      });
      if (SOURCE_EFFECTS.has(effect)) sourceAfter = updated;
      else destinationAfter = updated;
    }

    const appliedValue = PHYSICAL_EFFECTS.has(effect) ? roundMoney(quantity * appliedUnitCost) : 0;
    movementValue = roundMoney(movementValue + appliedValue);
    line.appliedUnitCost = appliedUnitCost;
    line.appliedValue = appliedValue;
    line.sourceBalanceAfter = sourceAfter ? stockSnapshot(sourceAfter) : null;
    line.destinationBalanceAfter = destinationAfter ? stockSnapshot(destinationAfter) : null;
  }

  movement.status = "posted";
  movement.postedAt = new Date();
  movement.postedBy = userId;
  movement.updatedBy = userId;
  movement.totalValue = movementValue;
  await movement.save({ session });
  return movement;
};

stockMovementSchema.statics.reverseMovementDocument = async function ({
  movementId,
  userId = null,
  reason = "",
  session,
}) {
  if (!session) throw Object.assign(new Error("Stock reversal requires a database transaction."), { statusCode: 500 });
  if (!isId(movementId)) throw Object.assign(new Error("Invalid stock movement ID."), { statusCode: 400 });

  const original = await this.findById(movementId).session(session);
  if (!original) throw Object.assign(new Error("Stock movement was not found."), { statusCode: 404 });
  if (original.status === "reversed" && original.reversedBy) {
    return this.findById(original.reversedBy).session(session);
  }
  if (original.status !== "posted") {
    throw Object.assign(new Error("Only a posted stock movement can be reversed."), { statusCode: 409 });
  }
  if (original.reversalOf) {
    throw Object.assign(new Error("A reversal movement cannot be reversed through this endpoint."), { statusCode: 409 });
  }

  const reversal = new this({
    movementDate: new Date(),
    movementType: "reversal",
    status: "draft",
    reference: original.movementNo,
    sourceType: "stock_movement_reversal",
    sourceId: original._id,
    currency: original.currency,
    reason: clean(reason) || `Reversal of ${original.movementNo}`,
    notes: `System-generated compensating movement for ${original.movementNo}.`,
    reversalOf: original._id,
    lines: original.lines.map(buildReversalLine),
    createdBy: userId,
    updatedBy: userId,
  });
  await reversal.save({ session });
  await this.postMovementDocument({ movementId: reversal._id, userId, session });

  original.status = "reversed";
  original.reversedBy = reversal._id;
  original.updatedBy = userId;
  await original.save({ session });
  return reversal;
};

export {
  MOVEMENT_TYPES,
  MOVEMENT_STATUSES,
  STOCK_EFFECTS,
  PHYSICAL_EFFECTS,
  SOURCE_EFFECTS,
  DESTINATION_EFFECTS,
};

export default mongoose.model("StockMovement", stockMovementSchema);
