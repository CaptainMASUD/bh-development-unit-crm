import mongoose from "mongoose";

const UNIT_STATUSES = ["active", "inactive", "archived"];
const UNIT_TYPES = ["count", "weight", "volume", "length", "area", "time", "other"];

const inventoryUnitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    nameLower: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    symbolKey: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },
    unitType: {
      type: String,
      enum: UNIT_TYPES,
      default: "count",
    },
    allowDecimal: {
      type: Boolean,
      default: false,
    },
    decimalPlaces: {
      type: Number,
      min: 0,
      max: 6,
      default: 0,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    sortOrder: {
      type: Number,
      min: 0,
      max: 1000000,
      default: 0,
    },
    status: {
      type: String,
      enum: UNIT_STATUSES,
      default: "active",
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

inventoryUnitSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    delete ret.symbolKey;
    return ret;
  },
});

inventoryUnitSchema.set("toObject", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    delete ret.symbolKey;
    return ret;
  },
});

inventoryUnitSchema.index({ code: 1 }, { unique: true });
inventoryUnitSchema.index({ nameLower: 1 }, { unique: true });
inventoryUnitSchema.index({ symbolKey: 1 }, { unique: true });
inventoryUnitSchema.index({ status: 1, sortOrder: 1, nameLower: 1, _id: 1 });
inventoryUnitSchema.index({ unitType: 1, status: 1, sortOrder: 1, nameLower: 1, _id: 1 });

const normalizeUnitPatch = (source = {}) => {
  const patch = source;

  if (patch.name !== undefined) {
    patch.name = String(patch.name || "").trim();
    patch.nameLower = patch.name.toLowerCase();
  }
  if (patch.code !== undefined) {
    patch.code = String(patch.code || "").trim().toUpperCase();
  }
  if (patch.symbol !== undefined) {
    patch.symbol = String(patch.symbol || "").trim();
    patch.symbolKey = patch.symbol.toLowerCase();
  }
  if (patch.unitType !== undefined) {
    patch.unitType = String(patch.unitType || "count").trim().toLowerCase();
  }
  if (patch.description !== undefined) {
    patch.description = String(patch.description || "").trim();
  }
  if (patch.decimalPlaces !== undefined) {
    patch.decimalPlaces = Number(patch.decimalPlaces);
  }
  if (patch.sortOrder !== undefined) {
    patch.sortOrder = Number(patch.sortOrder);
  }
  if (patch.status !== undefined) {
    patch.status = String(patch.status || "active").trim().toLowerCase();
  }

  if (patch.allowDecimal === false) patch.decimalPlaces = 0;

  if (patch.status === "archived") {
    patch.archivedAt = patch.archivedAt || new Date();
  } else if (patch.status !== undefined) {
    patch.archivedAt = null;
  }

  return patch;
};

inventoryUnitSchema.pre("validate", function (next) {
  normalizeUnitPatch(this);

  if (!this.allowDecimal) this.decimalPlaces = 0;
  if (this.allowDecimal && this.decimalPlaces < 1) {
    this.invalidate("decimalPlaces", "Decimal places must be at least 1 when decimal quantities are allowed.");
  }

  next();
});

inventoryUnitSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = normalizeUnitPatch(update.$set || update);

  if (update.$set) update.$set = patch;
  this.setUpdate(update);
  next();
});

export { UNIT_STATUSES, UNIT_TYPES };
export default mongoose.model("InventoryUnit", inventoryUnitSchema);
