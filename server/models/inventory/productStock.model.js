import mongoose from "mongoose";

const STOCK_STATUSES = ["active", "inactive", "archived"];

const roundQuantity = (value) => Math.round(Number(value || 0) * 1000000) / 1000000;
const roundMoney = (value) => Math.round(Number(value || 0) * 10000) / 10000;

const productStockSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
      index: true,
    },

    onHandQuantity: { type: Number, default: 0 },
    reservedQuantity: { type: Number, min: 0, default: 0 },
    quarantineQuantity: { type: Number, min: 0, default: 0 },
    availableQuantity: { type: Number, default: 0 },
    incomingQuantity: { type: Number, min: 0, default: 0 },
    outgoingQuantity: { type: Number, min: 0, default: 0 },

    averageCost: { type: Number, min: 0, default: 0 },
    inventoryValue: { type: Number, default: 0 },

    reorderLevel: { type: Number, min: 0, default: 0 },
    minimumStock: { type: Number, min: 0, default: 0 },
    maximumStock: { type: Number, min: 0, default: 0 },

    lastMovementAt: { type: Date, default: null, index: true },
    lastCountedAt: { type: Date, default: null },
    stockVersion: { type: Number, min: 0, default: 0 },

    status: {
      type: String,
      enum: STOCK_STATUSES,
      default: "active",
      index: true,
    },
    archivedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: true,
  }
);

productStockSchema.index({ product: 1, warehouse: 1, location: 1 }, { unique: true });
productStockSchema.index({ warehouse: 1, status: 1, product: 1, _id: 1 });
productStockSchema.index({ product: 1, status: 1, warehouse: 1, location: 1 });
productStockSchema.index({ warehouse: 1, location: 1, status: 1, product: 1 });
productStockSchema.index({ warehouse: 1, status: 1, availableQuantity: 1, product: 1 });
productStockSchema.index({ status: 1, lastMovementAt: -1, _id: -1 });

const normalizeStockPatch = (source = {}) => {
  const patch = source;

  for (const field of [
    "onHandQuantity",
    "reservedQuantity",
    "quarantineQuantity",
    "availableQuantity",
    "incomingQuantity",
    "outgoingQuantity",
    "reorderLevel",
    "minimumStock",
    "maximumStock",
  ]) {
    if (patch[field] !== undefined) patch[field] = roundQuantity(patch[field]);
  }

  for (const field of ["averageCost", "inventoryValue"]) {
    if (patch[field] !== undefined) patch[field] = roundMoney(patch[field]);
  }

  if (patch.status !== undefined) patch.status = String(patch.status || "active").trim().toLowerCase();
  if (patch.status === "archived") {
    patch.archivedAt = patch.archivedAt || new Date();
  } else if (patch.status !== undefined) {
    patch.archivedAt = null;
  }

  return patch;
};

productStockSchema.pre("validate", function (next) {
  normalizeStockPatch(this);

  this.availableQuantity = roundQuantity(
    Number(this.onHandQuantity || 0) -
      Number(this.reservedQuantity || 0) -
      Number(this.quarantineQuantity || 0)
  );
  this.inventoryValue = roundMoney(Number(this.onHandQuantity || 0) * Number(this.averageCost || 0));

  if (this.onHandQuantity >= 0 && this.reservedQuantity + this.quarantineQuantity > this.onHandQuantity) {
    this.invalidate(
      "availableQuantity",
      "Reserved and quarantine quantities cannot exceed on-hand quantity."
    );
  }

  if (this.maximumStock > 0 && this.minimumStock > this.maximumStock) {
    this.invalidate("maximumStock", "Maximum stock must be greater than or equal to minimum stock.");
  }

  if (this.maximumStock > 0 && this.reorderLevel > this.maximumStock) {
    this.invalidate("reorderLevel", "Reorder level cannot be greater than maximum stock.");
  }

  next();
});

productStockSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = normalizeStockPatch(update.$set || update);
  if (update.$set) update.$set = patch;
  this.setUpdate(update);
  next();
});

/**
 * Atomic current-balance update for the future StockMovement service.
 * Do not expose this as an unrestricted client-side stock editor.
 */
productStockSchema.statics.applyQuantityDelta = async function ({
  product,
  warehouse,
  location = null,
  onHandDelta = 0,
  reservedDelta = 0,
  quarantineDelta = 0,
  incomingDelta = 0,
  outgoingDelta = 0,
  averageCost,
  allowNegativeStock = false,
  movementDate = new Date(),
  userId = null,
  session = null,
}) {
  const key = { product, warehouse, location: location || null };
  const deltas = {
    onHandDelta: roundQuantity(onHandDelta),
    reservedDelta: roundQuantity(reservedDelta),
    quarantineDelta: roundQuantity(quarantineDelta),
    incomingDelta: roundQuantity(incomingDelta),
    outgoingDelta: roundQuantity(outgoingDelta),
  };

  await this.updateOne(
    key,
    {
      $setOnInsert: {
        ...key,
        onHandQuantity: 0,
        reservedQuantity: 0,
        quarantineQuantity: 0,
        availableQuantity: 0,
        incomingQuantity: 0,
        outgoingQuantity: 0,
        averageCost: 0,
        inventoryValue: 0,
        reorderLevel: 0,
        minimumStock: 0,
        maximumStock: 0,
        stockVersion: 0,
        status: "active",
        createdBy: userId,
        updatedBy: userId,
      },
    },
    { upsert: true, session }
  );

  const newOnHand = { $add: [{ $ifNull: ["$onHandQuantity", 0] }, deltas.onHandDelta] };
  const newReserved = { $add: [{ $ifNull: ["$reservedQuantity", 0] }, deltas.reservedDelta] };
  const newQuarantine = { $add: [{ $ifNull: ["$quarantineQuantity", 0] }, deltas.quarantineDelta] };
  const newIncoming = { $add: [{ $ifNull: ["$incomingQuantity", 0] }, deltas.incomingDelta] };
  const newOutgoing = { $add: [{ $ifNull: ["$outgoingQuantity", 0] }, deltas.outgoingDelta] };
  const newAvailable = { $subtract: [{ $subtract: [newOnHand, newReserved] }, newQuarantine] };
  const nextAverageCost = averageCost === undefined ? { $ifNull: ["$averageCost", 0] } : roundMoney(averageCost);

  const filter = { ...key, status: { $ne: "archived" } };
  const conditions = [
    { $gte: [newReserved, 0] },
    { $gte: [newQuarantine, 0] },
    { $gte: [newIncoming, 0] },
    { $gte: [newOutgoing, 0] },
  ];

  if (!allowNegativeStock) {
    conditions.push({ $gte: [newOnHand, 0] }, { $gte: [newAvailable, 0] });
  }

  filter.$expr = { $and: conditions };

  const stock = await this.findOneAndUpdate(
    filter,
    [
      {
        $set: {
          onHandQuantity: newOnHand,
          reservedQuantity: newReserved,
          quarantineQuantity: newQuarantine,
          availableQuantity: newAvailable,
          incomingQuantity: newIncoming,
          outgoingQuantity: newOutgoing,
          averageCost: nextAverageCost,
          inventoryValue: { $multiply: [newOnHand, nextAverageCost] },
          lastMovementAt: movementDate,
          stockVersion: { $add: [{ $ifNull: ["$stockVersion", 0] }, 1] },
          updatedBy: userId,
          updatedAt: "$$NOW",
        },
      },
    ],
    { new: true, session }
  );

  if (!stock) {
    throw Object.assign(
      new Error("The stock update would create an invalid or unavailable quantity."),
      { statusCode: 409 }
    );
  }

  return stock;
};

export { STOCK_STATUSES, roundQuantity, roundMoney };
export default mongoose.model("ProductStock", productStockSchema);
