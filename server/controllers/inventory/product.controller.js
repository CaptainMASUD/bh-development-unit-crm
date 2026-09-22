import mongoose from "mongoose";

import Product, {
  COSTING_METHODS,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  TAX_TYPES,
  TRACKING_TYPES,
} from "../../models/inventory/product.model.js";
import ProductCategory from "../../models/inventory/productCategory.model.js";
import Supplier, {
  SupplierProduct,
} from "../../models/supplier.model.js";
import { assertCostingMethodCanBeChanged } from "../../services/inventoryCosting.service.js";
import { assignDocumentNumber, finalizeDocumentNumberClaim } from "../../services/administration/documentNumbering.service.js";

/* =========================================================
   RESPONSE FIELD SELECTION
========================================================= */

const LIST_FIELDS = [
  "name",
  "sku",
  "barcode",
  "productType",
  "category",
  "brand",
  "baseUnit",
  "defaultSupplier",
  "imageUrl",
  "purchasePrice",
  "sellingPrice",
  "wholesalePrice",
  "currency",
  "trackInventory",
  "trackingType",
  "reorderLevel",
  "minimumStock",
  "maximumStock",
  "generalOrderQuantity",
  "status",
  "updatedAt",
].join(" ");

const OPTION_FIELDS =
  "name sku barcode sellingPrice currency status";

const PRODUCT_STATE_FIELDS = [
  "name",
  "sku",
  "productType",
  "baseUnit",
  "defaultSupplier",
  "trackInventory",
  "trackingType",
  "purchasePrice",
  "sellingPrice",
  "wholesalePrice",
  "minimumSellingPrice",
  "currency",
  "taxType",
  "taxRate",
  "reorderLevel",
  "minimumStock",
  "maximumStock",
  "generalOrderQuantity",
  "status",
].join(" ");

/* =========================================================
   HELPERS
========================================================= */

const clean = (value) => String(value ?? "").trim();

const isId = (value) =>
  mongoose.Types.ObjectId.isValid(String(value || ""));

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildCategoryProductCode = (categoryCode, usedSkus = []) => {
  const prefix = clean(categoryCode).toUpperCase();

  if (!prefix) return "";

  const expression = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`, "i");
  const highest = usedSkus.reduce((maximum, sku) => {
    const match = clean(sku).match(expression);
    return match ? Math.max(maximum, Number(match[1]) || 0) : maximum;
  }, 0);

  return `${prefix}${highest + 1}`;
};

const money = (value) =>
  Math.round(Number(value || 0) * 100) / 100;

const parseLimit = (
  value,
  fallback = 30,
  max = 100
) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    Math.max(Math.trunc(parsed), 1),
    max
  );
};

const parseBoolean = (value) => {
  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  return undefined;
};

const parseNumber = (value) => {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : Number.NaN;
};

const nullableId = (value) => {
  const normalized = clean(value);

  if (!normalized) {
    return null;
  }

  return isId(normalized)
    ? normalized
    : undefined;
};

/* =========================================================
   CURSOR PAGINATION
========================================================= */

const encodeCursor = (product) => {
  const payload = JSON.stringify({
    n: String(
      product.nameLower ||
      product.name ||
      ""
    ).toLowerCase(),

    id: String(product._id),
  });

  return Buffer.from(payload, "utf8")
    .toString("base64url");
};

const decodeCursor = (value) => {
  try {
    if (!value) {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(
        String(value),
        "base64url"
      ).toString("utf8")
    );

    if (
      typeof parsed?.n !== "string" ||
      !isId(parsed?.id)
    ) {
      return null;
    }

    return {
      nameLower: parsed.n,
      id: new mongoose.Types.ObjectId(parsed.id),
    };
  } catch {
    return null;
  }
};

/* =========================================================
   REQUEST PAYLOAD
========================================================= */

const buildProductPayload = (
  body = {},
  userId = null
) => {
  const payload = {};

  for (const field of [
    "name",
    "sku",
    "barcode",
    "description",
    "imageUrl",
  ]) {
    if (body[field] !== undefined) {
      payload[field] = clean(body[field]);
    }
  }

  for (const field of [
    "productType",
    "taxType",
    "trackingType",
    "costingMethod",
    "status",
  ]) {
    if (body[field] !== undefined) {
      payload[field] = clean(
        body[field]
      ).toLowerCase();
    }
  }

  if (body.currency !== undefined) {
    payload.currency = clean(
      body.currency || "BDT"
    ).toUpperCase();
  }

  for (const field of [
    "category",
    "brand",
    "baseUnit",
    "defaultSupplier",
    "inventoryAccount",
    "cogsAccount",
    "expenseAccount",
  ]) {
    if (body[field] !== undefined) {
      payload[field] = nullableId(
        body[field]
      );
    }
  }

  for (const field of [
    "standardCost",
    "purchasePrice",
    "sellingPrice",
    "wholesalePrice",
    "minimumSellingPrice",
    "taxRate",
    "reorderLevel",
    "minimumStock",
    "maximumStock",
    "generalOrderQuantity",
  ]) {
    if (body[field] !== undefined) {
      payload[field] = parseNumber(
        body[field]
      );
    }
  }

  for (const field of [
    "trackInventory",
    "allowNegativeStock",
  ]) {
    if (body[field] !== undefined) {
      payload[field] = parseBoolean(
        body[field]
      );
    }
  }

  if (userId) {
    payload.updatedBy = userId;
  }

  return payload;
};

/* =========================================================
   PAYLOAD VALIDATION
========================================================= */

const validatePayloadShape = (
  payload,
  { partial = false } = {}
) => {
  const errors = [];

  if (
    (!partial || payload.name !== undefined) &&
    !clean(payload.name)
  ) {
    errors.push("Product name is required.");
  }

  if (
    (!partial || payload.sku !== undefined) &&
    !clean(payload.sku)
  ) {
    errors.push("SKU is required.");
  }

  for (const field of [
    "category",
    "brand",
    "baseUnit",
    "defaultSupplier",
  ]) {
    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        field
      ) &&
      payload[field] === undefined
    ) {
      errors.push(
        `${field} must be a valid ID or empty.`
      );
    }
  }

  for (const field of [
    "trackInventory",
    "allowNegativeStock",
  ]) {
    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        field
      ) &&
      payload[field] === undefined
    ) {
      errors.push(
        `${field} must be true or false.`
      );
    }
  }

  if (payload.allowNegativeStock === true) {
    errors.push("Negative stock is strictly disabled until GL variance accounting is implemented.");
  }

  for (const field of [
    "purchasePrice",
    "sellingPrice",
    "wholesalePrice",
    "minimumSellingPrice",
    "taxRate",
    "reorderLevel",
    "minimumStock",
    "maximumStock",
    "generalOrderQuantity",
  ]) {
    if (
      payload[field] !== undefined &&
      (
        !Number.isFinite(payload[field]) ||
        payload[field] < 0
      )
    ) {
      errors.push(
        `${field} must be a valid non-negative number.`
      );
    }
  }

  const enumChecks = [
    ["productType", PRODUCT_TYPES],
    ["status", PRODUCT_STATUSES],
    ["trackingType", TRACKING_TYPES],
    ["costingMethod", COSTING_METHODS],
    ["taxType", TAX_TYPES],
  ];

  for (const [field, values] of enumChecks) {
    if (
      payload[field] !== undefined &&
      !values.includes(payload[field])
    ) {
      errors.push(
        `${field} has an invalid value.`
      );
    }
  }

  if (
    payload.taxRate !== undefined &&
    payload.taxRate > 100
  ) {
    errors.push(
      "Tax rate cannot be greater than 100."
    );
  }

  return errors;
};

/* =========================================================
   CROSS-FIELD VALIDATION
========================================================= */

const validateProductState = (state = {}) => {
  const errors = [];

  const productType =
    state.productType || "inventory";

  const trackInventory =
    productType === "inventory"
      ? state.trackInventory !== false
      : false;

  const trackingType = trackInventory
    ? state.trackingType || "none"
    : "none";

  if (
    !trackInventory &&
    trackingType !== "none"
  ) {
    errors.push(
      "Tracking type must be none when inventory tracking is disabled."
    );
  }

  if (
    Number(state.minimumSellingPrice || 0) >
      Number(state.sellingPrice || 0) &&
    Number(state.sellingPrice || 0) > 0
  ) {
    errors.push(
      "Minimum selling price cannot be greater than selling price."
    );
  }

  if (
    Number(state.maximumStock || 0) > 0 &&
    Number(state.minimumStock || 0) >
      Number(state.maximumStock || 0)
  ) {
    errors.push(
      "Maximum stock must be greater than or equal to minimum stock."
    );
  }

  if (
    Number(state.maximumStock || 0) > 0 &&
    Number(state.reorderLevel || 0) >
      Number(state.maximumStock || 0)
  ) {
    errors.push(
      "Reorder level cannot be greater than maximum stock."
    );
  }

  return errors;
};

/* =========================================================
   ERROR HANDLING
========================================================= */

const duplicateMessage = (error) => {
  const field = Object.keys(
    error?.keyPattern ||
    error?.keyValue ||
    {}
  )[0];

  if (field === "sku") {
    return "A product with this SKU already exists.";
  }

  if (field === "barcode") {
    return "A product with this barcode already exists.";
  }

  return "A product with the same unique value already exists.";
};

const sendWriteError = (
  res,
  error,
  fallbackMessage
) => {
  if (error?.code === 11000) {
    return res.status(409).json({
      message: duplicateMessage(error),
      error: error.message,
    });
  }

  if (
    error?.name === "ValidationError" ||
    error?.name === "CastError"
  ) {
    return res.status(400).json({
      message: error.message,
      error: error.message,
    });
  }

  return res
    .status(error?.statusCode || 500)
    .json({
      message: error?.statusCode
        ? error.message
        : fallbackMessage,

      error: error.message,
    });
};

/* =========================================================
   LIST FILTER
========================================================= */

const buildListFilter = (query = {}, tenantId = null) => {
  const filter = tenantId ? { tenantId } : {};

  if (
    query.status &&
    query.status !== "all"
  ) {
    filter.status = clean(
      query.status
    ).toLowerCase();
  } else {
    filter.status = {
      $in: [
        "active",
        "inactive",
        "discontinued",
      ],
    };
  }

  if (
    query.productType &&
    query.productType !== "all"
  ) {
    filter.productType = clean(
      query.productType
    ).toLowerCase();
  }

  if (
    query.trackingType &&
    query.trackingType !== "all"
  ) {
    filter.trackingType = clean(
      query.trackingType
    ).toLowerCase();
  }

  if (
    query.currency &&
    query.currency !== "all"
  ) {
    filter.currency = clean(
      query.currency
    ).toUpperCase();
  }

  if (isId(query.category)) {
    filter.category = query.category;
  }

  if (isId(query.brand)) {
    filter.brand = query.brand;
  }

  const trackInventory = parseBoolean(
    query.trackInventory
  );

  if (trackInventory !== undefined) {
    filter.trackInventory = trackInventory;
  }

  const q = clean(query.q);

  if (q) {
    const normalizedName = q.toLowerCase();
    const normalizedCode = q.toUpperCase();

    /*
     * Prefix regexes can use the corresponding indexes.
     * There is no "i" flag because values are already normalized.
     */
    const namePrefix = new RegExp(
      `^${escapeRegex(normalizedName)}`
    );

    const codePrefix = new RegExp(
      `^${escapeRegex(normalizedCode)}`
    );

    filter.$or = [
      {
        nameLower: namePrefix,
      },
      {
        sku: codePrefix,
      },
      {
        barcode: codePrefix,
      },
    ];
  }

  return filter;
};

/* =========================================================
   GET PRODUCT LIST
========================================================= */

export const listProducts = async (
  req,
  res
) => {
  try {
    const limit = parseLimit(
      req.query.limit,
      30,
      100
    );

    const cursor = decodeCursor(
      req.query.cursor
    );

    const filter = buildListFilter(
      req.query,
      req.tenantId
    );

    if (req.query.cursor && !cursor) {
      return res.status(400).json({
        message:
          "Invalid pagination cursor.",
      });
    }

    if (cursor) {
      filter.$and = [
        ...(filter.$and || []),

        {
          $or: [
            {
              nameLower: {
                $gt: cursor.nameLower,
              },
            },
            {
              nameLower:
                cursor.nameLower,

              _id: {
                $gt: cursor.id,
              },
            },
          ],
        },
      ];
    }

    const products = await Product.find(
      filter
    )
      .select(
        `${LIST_FIELDS} +nameLower`
      )
      .populate(
        "defaultSupplier",
        "code businessName status"
      )
      .sort({
        nameLower: 1,
        _id: 1,
      })
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean();

    const hasMore =
      products.length > limit;

    if (hasMore) {
      products.pop();
    }

    const nextCursor =
      hasMore && products.length
        ? encodeCursor(
            products[
              products.length - 1
            ]
          )
        : null;

    const data = products.map(
      ({ nameLower, ...product }) =>
        product
    );

    return res.json({
      count: data.length,
      hasMore,
      nextCursor,
      products: data,
    });
  } catch (error) {
    return res.status(500).json({
      message:
        "Failed to load products.",
      error: error.message,
    });
  }
};

/* =========================================================
   PRODUCT DROPDOWN OPTIONS
========================================================= */

export const listProductOptions = async (
  req,
  res
) => {
  try {
    const limit = parseLimit(
      req.query.limit,
      20,
      50
    );

    const filter = {
      ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      status: "active",
    };

    const q = clean(req.query.q);

    if (q) {
      const normalizedName =
        q.toLowerCase();

      const normalizedCode =
        q.toUpperCase();

      filter.$or = [
        {
          nameLower: new RegExp(
            `^${escapeRegex(
              normalizedName
            )}`
          ),
        },
        {
          sku: new RegExp(
            `^${escapeRegex(
              normalizedCode
            )}`
          ),
        },
        {
          barcode: new RegExp(
            `^${escapeRegex(
              normalizedCode
            )}`
          ),
        },
      ];
    }

    const products = await Product.find(
      filter
    )
      .select(OPTION_FIELDS)
      .sort({
        nameLower: 1,
        _id: 1,
      })
      .limit(limit)
      .maxTimeMS(3000)
      .lean();

    return res.json({
      count: products.length,
      products,
    });
  } catch (error) {
    return res.status(500).json({
      message:
        "Failed to load product options.",
      error: error.message,
    });
  }
};

/* =========================================================
   GET SINGLE PRODUCT
========================================================= */

export const getProduct = async (
  req,
  res
) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    const product =
      await Product.findOne({
        _id: req.params.id,
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
      })
        .select("-nameLower")
        .populate(
          "defaultSupplier",
          "code businessName status"
        )
        .maxTimeMS(3000)
        .lean();

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    return res.json({
      product,
    });
  } catch (error) {
    return res.status(500).json({
      message:
        "Failed to load product.",
      error: error.message,
    });
  }
};

/* =========================================================
   SKU / BARCODE LOOKUP
========================================================= */

export const lookupProduct = async (
  req,
  res
) => {
  try {
    const code = clean(
      req.params.code
    ).toUpperCase();

    if (!code) {
      return res.status(400).json({
        message:
          "SKU or barcode is required.",
      });
    }

    const product =
      await Product.findOne({
        ...(req.tenantId ? { tenantId: req.tenantId } : {}),
        status: {
          $ne: "archived",
        },

        $or: [
          {
            sku: code,
          },
          {
            barcode: code,
          },
        ],
      })
        .select(LIST_FIELDS)
        .populate(
          "defaultSupplier",
          "code businessName status"
        )
        .maxTimeMS(3000)
        .lean();

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    return res.json({
      product,
    });
  } catch (error) {
    return res.status(500).json({
      message:
        "Failed to find product.",
      error: error.message,
    });
  }
};

/* =========================================================
   CREATE PRODUCT
========================================================= */

export const createProduct = async (
  req,
  res
) => {
  try {
    const userId =
      req.user?._id || null;
    const tenantId = req.tenantId;

    const payload =
      buildProductPayload(
        req.body,
        userId
      );
    if (tenantId) payload.tenantId = tenantId;

    const errors = [
      ...validatePayloadShape(payload, { partial: true }),
      ...validateProductState(payload),
    ];

    if (errors.length) {
      return res.status(400).json({
        message: errors[0],
        errors,
      });
    }

    await assertSelectableSupplier(
      payload.defaultSupplier,
      tenantId
    );

    const category = payload.category && isId(payload.category)
      ? await ProductCategory.findOne({ _id: payload.category, tenantId }).select("code").lean()
      : null;
    if (!category?.code) return res.status(400).json({ message: "A valid category with a code is required." });
    const allocatedSku = await assignDocumentNumber({
      tenantId, typeKey: "inventory.product", providedValue: payload.sku,
      context: { categoryCode: category.code }, source: "inventory.product.create",
    });
    payload.sku = allocatedSku.value;

    for (const field of [
      "purchasePrice",
      "sellingPrice",
      "wholesalePrice",
      "minimumSellingPrice",
    ]) {
      if (payload[field] !== undefined) {
        payload[field] = money(
          payload[field]
        );
      }
    }

    const product = await Product.create({
      ...payload,
      ...(tenantId ? { tenantId } : {}),
      createdBy: userId,
      updatedBy: userId,
    });
    await finalizeDocumentNumberClaim({ tenantId, typeKey: "inventory.product", value: payload.sku, recordId: product._id });

    let supplierProduct = null;

    try {
      supplierProduct =
        await syncDefaultSupplierLink(
          product,
          userId,
          tenantId
        );
    } catch (error) {
      await Product.deleteOne({
        _id: product._id,
        ...(tenantId ? { tenantId } : {}),
      }).catch(() => {});
      throw error;
    }

    return res.status(201).json({
      message: supplierProduct
        ? "Product created and linked to the selected supplier."
        : "Product created.",
      product,
      supplierProduct,
    });
  } catch (error) {
    return sendWriteError(
      res,
      error,
      "Failed to create product."
    );
  }
};

/* =========================================================
   UPDATE PRODUCT
========================================================= */

export const updateProduct = async (
  req,
  res
) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    const tenantId = req.tenantId;

    const payload =
      buildProductPayload(
        req.body,
        req.user?._id || null
      );

    const editableKeys =
      Object.keys(payload).filter(
        (key) => key !== "updatedBy"
      );

    if (!editableKeys.length) {
      return res.status(400).json({
        message:
          "No valid product fields were provided.",
      });
    }

    const shapeErrors =
      validatePayloadShape(payload, {
        partial: true,
      });

    if (shapeErrors.length) {
      return res.status(400).json({
        message: shapeErrors[0],
        errors: shapeErrors,
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        "defaultSupplier"
      )
    ) {
      await assertSelectableSupplier(
        payload.defaultSupplier,
        tenantId
      );
    }

    /*
     * Load only the fields required for cross-field validation.
     * This keeps the validation read lightweight.
     */
    const current =
      await Product.findOne({
        _id: req.params.id,
        ...(tenantId ? { tenantId } : {}),
      })
        .select(PRODUCT_STATE_FIELDS)
        .lean();

    if (!current) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    if (
      current.status === "archived"
    ) {
      return res.status(409).json({
        message:
          "Restore the archived product before editing it.",
      });
    }

    if (
      payload.costingMethod &&
      current.costingMethod &&
      payload.costingMethod !== current.costingMethod
    ) {
      await assertCostingMethodCanBeChanged(
        tenantId || current.tenantId,
        current._id
      );
    }

    const stateErrors =
      validateProductState({
        ...current,
        ...payload,
      });

    if (stateErrors.length) {
      return res.status(400).json({
        message: stateErrors[0],
        errors: stateErrors,
      });
    }

    for (const field of [
      "purchasePrice",
      "sellingPrice",
      "wholesalePrice",
      "minimumSellingPrice",
    ]) {
      if (payload[field] !== undefined) {
        payload[field] = money(
          payload[field]
        );
      }
    }

    const product =
      await Product.findOneAndUpdate(
        {
          _id: req.params.id,
          ...(tenantId ? { tenantId } : {}),
        },
        payload,
        {
          new: true,
          runValidators: true,
          context: "query",
        }
      ).select("-nameLower");

    const supplierProduct =
      Object.prototype.hasOwnProperty.call(
        payload,
        "defaultSupplier"
      )
        ? await syncDefaultSupplierLink(
            product,
            req.user?._id || null,
            tenantId
          )
        : null;

    return res.json({
      message: supplierProduct
        ? "Product and supplier relationship updated."
        : "Product updated.",
      product,
      supplierProduct,
    });
  } catch (error) {
    return sendWriteError(
      res,
      error,
      "Failed to update product."
    );
  }
};

/* =========================================================
   UPDATE PRODUCT STATUS
========================================================= */

export const updateProductStatus = async (
  req,
  res
) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    const status = clean(
      req.body.status
    ).toLowerCase();

    if (
      !PRODUCT_STATUSES.includes(
        status
      ) ||
      status === "archived"
    ) {
      return res.status(400).json({
        message:
          "Status must be active, inactive, or discontinued.",
      });
    }

    const product =
      await Product.findOneAndUpdate(
        {
          _id: req.params.id,
          ...(req.tenantId ? { tenantId: req.tenantId } : {}),
          status: {
            $ne: "archived",
          },
        },
        {
          status,
          archivedAt: null,
          updatedBy:
            req.user?._id || null,
        },
        {
          new: true,
          runValidators: true,
        }
      ).select(LIST_FIELDS);

    if (!product) {
      return res.status(404).json({
        message:
          "Product not found or archived.",
      });
    }

    return res.json({
      message:
        "Product status updated.",
      product,
    });
  } catch (error) {
    return sendWriteError(
      res,
      error,
      "Failed to update product status."
    );
  }
};

/* =========================================================
   ARCHIVE PRODUCT
========================================================= */

export const deleteProduct = async (
  req,
  res
) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    /*
     * Products should not be physically deleted because future stock,
     * purchase, sales and accounting records may reference them.
     */
    const product =
      await Product.findOneAndUpdate(
        {
          _id: req.params.id,
          ...(req.tenantId ? { tenantId: req.tenantId } : {}),
          status: {
            $ne: "archived",
          },
        },
        {
          status: "archived",
          archivedAt: new Date(),
          updatedBy:
            req.user?._id || null,
        },
        {
          new: true,
          runValidators: true,
        }
      ).select(
        "name sku status archivedAt"
      );

    if (!product) {
      return res.status(404).json({
        message:
          "Product not found or already archived.",
      });
    }

    return res.json({
      message:
        "Product archived. Historical references remain safe.",
      product,
    });
  } catch (error) {
    return sendWriteError(
      res,
      error,
      "Failed to archive product."
    );
  }
};

/* =========================================================
   RESTORE PRODUCT
========================================================= */

export const restoreProduct = async (
  req,
  res
) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    const product =
      await Product.findOneAndUpdate(
        {
          _id: req.params.id,
          ...(req.tenantId ? { tenantId: req.tenantId } : {}),
          status: "archived",
        },
        {
          status: "inactive",
          archivedAt: null,
          updatedBy:
            req.user?._id || null,
        },
        {
          new: true,
          runValidators: true,
        }
      ).select(LIST_FIELDS);

    if (!product) {
      return res.status(404).json({
        message:
          "Archived product not found.",
      });
    }

    return res.json({
      message:
        "Product restored as inactive.",
      product,
    });
  } catch (error) {
    return sendWriteError(
      res,
      error,
      "Failed to restore product."
    );
  }
};

const assertSelectableSupplier = async (supplierId, tenantId = null) => {
  if (!supplierId) return null;

  const supplier = await Supplier.findOne({
    _id: supplierId,
    ...(tenantId ? { tenantId } : {}),
    status: "active",
  })
    .select("_id businessName status procurement.currency")
    .maxTimeMS(3000)
    .lean();

  if (!supplier) {
    const error = new Error(
      "The selected default supplier was not found or is not active."
    );
    error.statusCode = 409;
    throw error;
  }

  return supplier;
};

const syncDefaultSupplierLink = async (
  product,
  actorId = null,
  tenantId = null
) => {
  const productId = product?._id;
  const supplierId = product?.defaultSupplier?._id || product?.defaultSupplier;

  if (!productId) return null;

  await SupplierProduct.updateMany(
    {
      ...(tenantId ? { tenantId } : {}),
      product: productId,
      isPreferred: true,
      ...(supplierId ? { supplier: { $ne: supplierId } } : {}),
    },
    {
      $set: {
        isPreferred: false,
        updatedBy: actorId,
      },
    }
  );

  if (!supplierId) return null;

  const link = await SupplierProduct.findOneAndUpdate(
    {
      ...(tenantId ? { tenantId } : {}),
      supplier: supplierId,
      product: productId,
    },
    {
      $set: {
        status: "active",
        isPreferred: true,
        archivedAt: null,
        archivedBySupplier: false,
        previousStatus: "",
        updatedBy: actorId,
      },
      $setOnInsert: {
        ...(tenantId ? { tenantId } : {}),
        purchaseUnit: product.baseUnit || null,
        supplierSku: product.sku || "",
        supplierProductName: product.name || "",
        unitPrice: money(product.purchasePrice),
        currency: clean(product.currency || "BDT").toUpperCase(),
        minimumOrderQuantity: 0,
        packSize: 1,
        leadTimeDays: 0,
        discountPercent: 0,
        taxRate: 0,
        createdBy: actorId,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return link;
};
