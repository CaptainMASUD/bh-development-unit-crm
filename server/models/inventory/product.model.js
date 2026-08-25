import mongoose from "mongoose";

const PRODUCT_TYPES = ["inventory", "non_inventory", "service"];
const PRODUCT_STATUSES = ["active", "inactive", "discontinued", "archived"];
const TRACKING_TYPES = ["none", "batch", "serial", "expiry", "batch_expiry"];
const COSTING_METHODS = ["weighted_average", "fifo", "standard"];
const TAX_TYPES = ["none", "exclusive", "inclusive"];

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    // Used internally for fast case-insensitive searching and sorting.
    nameLower: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },

    barcode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },

    productType: {
      type: String,
      enum: PRODUCT_TYPES,
      default: "inventory",
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductCategory",
      default: null,
    },

    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductBrand",
      default: null,
    },

    baseUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryUnit",
      default: null,
    },

    defaultSupplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    imageUrl: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    purchasePrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    sellingPrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    wholesalePrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    minimumSellingPrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 12,
      default: "BDT",
    },

    taxType: {
      type: String,
      enum: TAX_TYPES,
      default: "none",
    },

    taxRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    trackInventory: {
      type: Boolean,
      default: true,
    },

    trackingType: {
      type: String,
      enum: TRACKING_TYPES,
      default: "none",
    },

    costingMethod: {
      type: String,
      enum: COSTING_METHODS,
      default: "weighted_average",
    },

    allowNegativeStock: {
      type: Boolean,
      default: false,
    },

    reorderLevel: {
      type: Number,
      min: 0,
      default: 0,
    },

    minimumStock: {
      type: Number,
      min: 0,
      default: 0,
    },

    maximumStock: {
      type: Number,
      min: 0,
      default: 0,
    },

    generalOrderQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      enum: PRODUCT_STATUSES,
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

/* =========================================================
   RESPONSE TRANSFORMATION
========================================================= */

productSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    return ret;
  },
});

productSchema.set("toObject", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    return ret;
  },
});

/* =========================================================
   DATABASE INDEXES
========================================================= */

// SKU must be globally unique.
productSchema.index({ sku: 1 }, { unique: true });

// Empty barcodes are allowed, but non-empty barcodes must be unique.
productSchema.index(
  { barcode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      barcode: {
        $type: "string",
        $gt: "",
      },
    },
  }
);

// General listing and prefix searching.
productSchema.index({
  nameLower: 1,
  _id: 1,
});

// Status-based product listing.
productSchema.index({
  status: 1,
  nameLower: 1,
  _id: 1,
});

// Category filtering.
productSchema.index({
  category: 1,
  status: 1,
  nameLower: 1,
  _id: 1,
});

// Brand filtering.
productSchema.index({
  brand: 1,
  status: 1,
  nameLower: 1,
  _id: 1,
});

// Supplier-based product sourcing and inventory filtering.
productSchema.index({
  defaultSupplier: 1,
  status: 1,
  nameLower: 1,
  _id: 1,
});

// Product-type filtering.
productSchema.index({
  productType: 1,
  status: 1,
  nameLower: 1,
  _id: 1,
});

// Inventory-tracking filtering.
productSchema.index({
  trackInventory: 1,
  status: 1,
  nameLower: 1,
  _id: 1,
});

/* =========================================================
   NORMALIZATION
========================================================= */

const normalizeProductPatch = (source = {}) => {
  const patch = source;

  if (patch.name !== undefined) {
    patch.name = String(patch.name || "").trim();
    patch.nameLower = patch.name.toLowerCase();
  }

  if (patch.sku !== undefined) {
    patch.sku = String(patch.sku || "").trim().toUpperCase();
  }

  if (patch.barcode !== undefined) {
    patch.barcode = String(patch.barcode || "").trim().toUpperCase();
  }

  if (patch.currency !== undefined) {
    patch.currency = String(patch.currency || "BDT")
      .trim()
      .toUpperCase();
  }

  if (patch.description !== undefined) {
    patch.description = String(patch.description || "").trim();
  }

  if (patch.imageUrl !== undefined) {
    patch.imageUrl = String(patch.imageUrl || "").trim();
  }

  if (patch.productType !== undefined) {
    patch.productType = String(patch.productType || "inventory")
      .trim()
      .toLowerCase();
  }

  if (patch.status !== undefined) {
    patch.status = String(patch.status || "active")
      .trim()
      .toLowerCase();
  }

  if (patch.trackingType !== undefined) {
    patch.trackingType = String(patch.trackingType || "none")
      .trim()
      .toLowerCase();
  }

  if (patch.costingMethod !== undefined) {
    patch.costingMethod = String(
      patch.costingMethod || "weighted_average"
    )
      .trim()
      .toLowerCase();
  }

  if (patch.taxType !== undefined) {
    patch.taxType = String(patch.taxType || "none")
      .trim()
      .toLowerCase();
  }

  /*
   * Services and non-inventory products must not maintain stock.
   */
  if (
    patch.trackInventory === false ||
    (patch.productType !== undefined &&
      patch.productType !== "inventory")
  ) {
    patch.trackInventory = false;
    patch.trackingType = "none";
    patch.allowNegativeStock = false;
    patch.reorderLevel = 0;
    patch.minimumStock = 0;
    patch.maximumStock = 0;
    patch.generalOrderQuantity = 0;
  }

  if (patch.status === "archived") {
    patch.archivedAt = patch.archivedAt || new Date();
  } else if (patch.status !== undefined) {
    patch.archivedAt = null;
  }

  return patch;
};

/* =========================================================
   DOCUMENT VALIDATION
========================================================= */

productSchema.pre("validate", function (next) {
  normalizeProductPatch(this);

  if (!this.trackInventory && this.trackingType !== "none") {
    this.invalidate(
      "trackingType",
      "Tracking type must be none when inventory tracking is disabled."
    );
  }

  if (
    this.maximumStock > 0 &&
    this.minimumStock > this.maximumStock
  ) {
    this.invalidate(
      "maximumStock",
      "Maximum stock must be greater than or equal to minimum stock."
    );
  }

  if (
    this.maximumStock > 0 &&
    this.reorderLevel > this.maximumStock
  ) {
    this.invalidate(
      "reorderLevel",
      "Reorder level cannot be greater than maximum stock."
    );
  }

  if (
    this.minimumSellingPrice > 0 &&
    this.sellingPrice > 0 &&
    this.minimumSellingPrice > this.sellingPrice
  ) {
    this.invalidate(
      "minimumSellingPrice",
      "Minimum selling price cannot be greater than selling price."
    );
  }

  next();
});

/* =========================================================
   QUERY UPDATE NORMALIZATION
========================================================= */

productSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = normalizeProductPatch(update.$set || update);

  if (update.$set) {
    update.$set = patch;
  }

  this.setUpdate(update);
  next();
});

export {
  PRODUCT_TYPES,
  PRODUCT_STATUSES,
  TRACKING_TYPES,
  COSTING_METHODS,
  TAX_TYPES,
};

export default mongoose.model("Product", productSchema);
