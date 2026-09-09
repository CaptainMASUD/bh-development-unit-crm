import mongoose from "mongoose";

const LOCATION_TYPES = [
  "zone",
  "aisle",
  "rack",
  "shelf",
  "bin",
  "receiving",
  "dispatch",
  "returns",
  "quarantine",
  "damaged",
  "other",
];

const LOCATION_STATUSES = ["active", "inactive", "archived"];

const warehouseLocationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    nameLower: { type: String, trim: true, default: "", select: false },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
    locationType: {
      type: String,
      enum: LOCATION_TYPES,
      default: "bin",
      index: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
      index: true,
    },
    ancestors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WarehouseLocation",
      },
    ],
    depth: { type: Number, min: 0, max: 20, default: 0 },
    sortOrder: { type: Number, min: 0, max: 1000000, default: 0 },
    description: { type: String, trim: true, maxlength: 1500, default: "" },
    barcode: { type: String, trim: true, uppercase: true, maxlength: 120, default: "" },
    capacityQuantity: { type: Number, min: 0, default: 0 },
    isReceivable: { type: Boolean, default: false },
    isPickable: { type: Boolean, default: true },
    isDispatchable: { type: Boolean, default: false },
    isQuarantine: { type: Boolean, default: false },
    status: {
      type: String,
      enum: LOCATION_STATUSES,
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

warehouseLocationSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    return ret;
  },
});

warehouseLocationSchema.set("toObject", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    return ret;
  },
});

warehouseLocationSchema.index({ tenantId: 1, warehouse: 1, code: 1 }, { unique: true });
warehouseLocationSchema.index(
  { tenantId: 1, warehouse: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $type: "string", $gt: "" } },
  }
);
warehouseLocationSchema.index({ tenantId: 1, warehouse: 1, parent: 1, sortOrder: 1, nameLower: 1, _id: 1 });
warehouseLocationSchema.index({ tenantId: 1, warehouse: 1, status: 1, sortOrder: 1, nameLower: 1, _id: 1 });
warehouseLocationSchema.index({ tenantId: 1, warehouse: 1, locationType: 1, status: 1, nameLower: 1, _id: 1 });
warehouseLocationSchema.index({ tenantId: 1, warehouse: 1, ancestors: 1, status: 1 });
warehouseLocationSchema.index(
  { tenantId: 1, warehouse: 1, parent: 1, nameLower: 1 },
  { unique: true }
);

const normalizeLocationPatch = (source = {}) => {
  const patch = source;

  if (patch.name !== undefined) {
    patch.name = String(patch.name || "").trim();
    patch.nameLower = patch.name.toLowerCase();
  }
  if (patch.code !== undefined) patch.code = String(patch.code || "").trim().toUpperCase();
  if (patch.barcode !== undefined) patch.barcode = String(patch.barcode || "").trim().toUpperCase();
  if (patch.locationType !== undefined) {
    patch.locationType = String(patch.locationType || "bin").trim().toLowerCase();
  }
  if (patch.description !== undefined) patch.description = String(patch.description || "").trim();
  if (patch.status !== undefined) patch.status = String(patch.status || "active").trim().toLowerCase();

  if (patch.isQuarantine === true) {
    patch.isPickable = false;
    patch.isDispatchable = false;
  }

  if (patch.status === "archived") {
    patch.archivedAt = patch.archivedAt || new Date();
    patch.isReceivable = false;
    patch.isPickable = false;
    patch.isDispatchable = false;
  } else if (patch.status !== undefined) {
    patch.archivedAt = null;
  }

  return patch;
};

warehouseLocationSchema.pre("validate", function (next) {
  normalizeLocationPatch(this);

  if (this.parent && String(this.parent) === String(this._id)) {
    this.invalidate("parent", "A warehouse location cannot be its own parent.");
  }

  if (this.ancestors?.some((id) => String(id) === String(this._id))) {
    this.invalidate("ancestors", "The location hierarchy contains a cycle.");
  }

  if (this.depth !== (this.ancestors?.length || 0)) {
    this.depth = this.ancestors?.length || 0;
  }

  if (this.isQuarantine) {
    this.isPickable = false;
    this.isDispatchable = false;
  }

  next();
});

warehouseLocationSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = normalizeLocationPatch(update.$set || update);
  if (update.$set) update.$set = patch;
  this.setUpdate(update);
  next();
});

export { LOCATION_TYPES, LOCATION_STATUSES };
export default mongoose.model("WarehouseLocation", warehouseLocationSchema);
