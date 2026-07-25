import mongoose from "mongoose";

const WAREHOUSE_TYPES = [
  "central",
  "regional",
  "store",
  "distribution",
  "transit",
  "returns",
  "production",
  "virtual",
  "other",
];

const WAREHOUSE_STATUSES = ["active", "inactive", "archived"];

const addressSchema = new mongoose.Schema(
  {
    addressLine1: { type: String, trim: true, maxlength: 250, default: "" },
    addressLine2: { type: String, trim: true, maxlength: 250, default: "" },
    area: { type: String, trim: true, maxlength: 120, default: "" },
    city: { type: String, trim: true, maxlength: 120, default: "" },
    state: { type: String, trim: true, maxlength: 120, default: "" },
    postalCode: { type: String, trim: true, maxlength: 40, default: "" },
    country: { type: String, trim: true, maxlength: 120, default: "Bangladesh" },
  },
  { _id: false }
);

const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    nameLower: { type: String, trim: true, default: "", select: false },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 50 },
    warehouseType: {
      type: String,
      enum: WAREHOUSE_TYPES,
      default: "store",
      index: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    address: { type: addressSchema, default: () => ({}) },
    contactName: { type: String, trim: true, maxlength: 160, default: "" },
    phone: { type: String, trim: true, maxlength: 60, default: "" },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 180,
      default: "",
      validate: {
        validator: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: "Enter a valid warehouse email address.",
      },
    },
    timezone: { type: String, trim: true, maxlength: 80, default: "Asia/Dhaka" },
    isDefault: { type: Boolean, default: false, index: true },
    allowNegativeStock: { type: Boolean, default: false },
    status: {
      type: String,
      enum: WAREHOUSE_STATUSES,
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

warehouseSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    return ret;
  },
});

warehouseSchema.set("toObject", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    return ret;
  },
});

warehouseSchema.index({ code: 1 }, { unique: true });
warehouseSchema.index({ nameLower: 1, _id: 1 });
warehouseSchema.index({ status: 1, nameLower: 1, _id: 1 });
warehouseSchema.index({ branch: 1, status: 1, nameLower: 1, _id: 1 });
warehouseSchema.index({ warehouseType: 1, status: 1, nameLower: 1, _id: 1 });
warehouseSchema.index(
  { branch: 1, isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true },
  }
);

const normalizeAddress = (address = {}) => ({
  addressLine1: String(address.addressLine1 || "").trim(),
  addressLine2: String(address.addressLine2 || "").trim(),
  area: String(address.area || "").trim(),
  city: String(address.city || "").trim(),
  state: String(address.state || "").trim(),
  postalCode: String(address.postalCode || "").trim(),
  country: String(address.country || "Bangladesh").trim() || "Bangladesh",
});

const normalizeWarehousePatch = (source = {}) => {
  const patch = source;

  if (patch.name !== undefined) {
    patch.name = String(patch.name || "").trim();
    patch.nameLower = patch.name.toLowerCase();
  }
  if (patch.code !== undefined) patch.code = String(patch.code || "").trim().toUpperCase();
  if (patch.warehouseType !== undefined) {
    patch.warehouseType = String(patch.warehouseType || "store").trim().toLowerCase();
  }
  if (patch.description !== undefined) patch.description = String(patch.description || "").trim();
  if (patch.contactName !== undefined) patch.contactName = String(patch.contactName || "").trim();
  if (patch.phone !== undefined) patch.phone = String(patch.phone || "").trim();
  if (patch.email !== undefined) patch.email = String(patch.email || "").trim().toLowerCase();
  if (patch.timezone !== undefined) patch.timezone = String(patch.timezone || "Asia/Dhaka").trim() || "Asia/Dhaka";
  if (patch.address !== undefined) patch.address = normalizeAddress(patch.address || {});
  if (patch.status !== undefined) patch.status = String(patch.status || "active").trim().toLowerCase();

  if (patch.status === "archived") {
    patch.archivedAt = patch.archivedAt || new Date();
    patch.isDefault = false;
  } else if (patch.status !== undefined) {
    patch.archivedAt = null;
  }

  return patch;
};

warehouseSchema.pre("validate", function (next) {
  normalizeWarehousePatch(this);

  if (this.isDefault && this.status !== "active") {
    this.invalidate("isDefault", "Only an active warehouse can be the default warehouse.");
  }

  if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
    this.invalidate("email", "Enter a valid warehouse email address.");
  }

  next();
});

warehouseSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = normalizeWarehousePatch(update.$set || update);
  if (update.$set) update.$set = patch;
  this.setUpdate(update);
  next();
});

export { WAREHOUSE_TYPES, WAREHOUSE_STATUSES };
export default mongoose.model("Warehouse", warehouseSchema);
