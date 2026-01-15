import mongoose from "mongoose"
import Product from "../models/productlist.model.js"
import { writeProductAuditLog } from "./productAudit.controller.js"

// ---- helpers ----
const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url")
const decode = (str) => JSON.parse(Buffer.from(str, "base64url").toString())

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

// Build a shared filter from query params so pagination & count use the same logic
function makeFilter(query) {
  const { q, category, brand, minPrice, maxPrice } = query || {}
  const filter = {}

  if (category) filter.category = category
  if (brand) filter.brand = brand

  // price range on sellPrice
  const priceFilter = {}
  if (minPrice !== undefined) priceFilter.$gte = Number(minPrice)
  if (maxPrice !== undefined) priceFilter.$lte = Number(maxPrice)
  if (Object.keys(priceFilter).length) filter.sellPrice = priceFilter

  if (q && q.trim()) {
    // use text index (description/brand/category) – see model indexes
    filter.$text = { $search: q.trim() }
  }
  return filter
}

// ---- CRUD ----

// Create a new product
export const createProduct = async (req, res) => {
  try {
    const { barcode, description, category, brand, purchasePrice, sellPrice, totalQuantity } = req.body
    const product = new Product({ barcode, description, category, brand, purchasePrice, sellPrice, totalQuantity })
    await product.save()

    try {
      await writeProductAuditLog({
        productId: product._id,
        oldDoc: null,
        newDoc: product.toObject(),
        actor: {
          userId: req.user?.id || "system",
          name: req.user?.name || "System",
          role: req.user?.role || "admin",
        },
        request: {
          ip: req.ip || req.connection?.remoteAddress,
          userAgent: req.get("User-Agent"),
          source: "api",
          correlationId: req.headers["x-correlation-id"],
        },
        note: "Product created via API",
      })
    } catch (auditError) {
      console.error("Failed to create audit log:", auditError)
      // Don't fail the main operation if audit logging fails
    }

    res.status(201).json({ message: "Product added successfully", product })
  } catch (error) {
    res.status(500).json({ message: "Error adding product", error: error?.message || error })
  }
}

// Legacy: Get all products (guarded)
export const getAllProducts = async (_req, res) => {
  try {
    const products = await Product.find().limit(1000).lean() // prevent huge pulls
    res.status(200).json(products)
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error: error?.message || error })
  }
}

// Get product by ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid product ID format" })

    const product = await Product.findById(id).lean()
    if (!product) return res.status(404).json({ message: "Product not found" })

    res.status(200).json(product)
  } catch (error) {
    res.status(500).json({ message: "Error fetching product", error: error?.message || error })
  }
}

// Update product
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid product ID format" })

    const { barcode, description, category, brand, purchasePrice, sellPrice, totalQuantity } = req.body

    const oldProduct = await Product.findById(id).lean()
    if (!oldProduct) return res.status(404).json({ message: "Product not found" })

    const product = await Product.findByIdAndUpdate(
      id,
      { barcode, description, category, brand, purchasePrice, sellPrice, totalQuantity },
      { new: true, runValidators: true },
    ).lean()

    try {
      await writeProductAuditLog({
        productId: product._id,
        oldDoc: oldProduct,
        newDoc: product,
        actor: {
          userId: req.user?.id || "system",
          name: req.user?.name || "System",
          role: req.user?.role || "admin",
        },
        request: {
          ip: req.ip || req.connection?.remoteAddress,
          userAgent: req.get("User-Agent"),
          source: "api",
          correlationId: req.headers["x-correlation-id"],
        },
        note: "Product updated via API",
      })
    } catch (auditError) {
      console.error("Failed to create audit log:", auditError)
      // Don't fail the main operation if audit logging fails
    }

    res.status(200).json({ message: "Product updated successfully", product })
  } catch (error) {
    res.status(500).json({ message: "Error updating product", error: error?.message || error })
  }
}

// Delete product
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid product ID format" })

    const product = await Product.findById(id).lean()
    if (!product) return res.status(404).json({ message: "Product not found" })

    await Product.findByIdAndDelete(id)

    try {
      await writeProductAuditLog({
        productId: product._id,
        oldDoc: product,
        newDoc: null,
        actor: {
          userId: req.user?.id || "system",
          name: req.user?.name || "System",
          role: req.user?.role || "admin",
        },
        request: {
          ip: req.ip || req.connection?.remoteAddress,
          userAgent: req.get("User-Agent"),
          source: "api",
          correlationId: req.headers["x-correlation-id"],
        },
        note: "Product deleted via API",
      })
    } catch (auditError) {
      console.error("Failed to create audit log:", auditError)
      // Don't fail the main operation if audit logging fails
    }

    res.status(200).json({ message: "Product deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error: error?.message || error })
  }
}

// ---- Performance endpoints ----

// Cursor-paginated listing with filters & field projection
export const getProductsPaginated = async (req, res) => {
  try {
    const {
      limit: limitRaw,
      after, // base64 cursor { lastId }
      q,
      category,
      brand,
      minPrice,
      maxPrice,
      fields, // comma list: "description,brand,sellPrice"
      sort = "newest", // 'newest' or 'oldest'
    } = req.query

    // clamp limit
    let limit = Number(limitRaw) || 50
    if (limit < 1) limit = 1
    if (limit > 200) limit = 200

    const filter = makeFilter({ q, category, brand, minPrice, maxPrice })

    // sort and cursor
    const sortSpec = sort === "oldest" ? { _id: 1 } : { _id: -1 }
    if (after) {
      const { lastId } = decode(after)
      if (isValidObjectId(lastId)) {
        if (sort === "oldest") {
          filter._id = { $gt: new mongoose.Types.ObjectId(lastId) }
        } else {
          filter._id = { $lt: new mongoose.Types.ObjectId(lastId) }
        }
      }
    }

    // projection
    const projection = {}
    if (fields) {
      const allow = new Set(
        fields
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      for (const f of allow) projection[f] = 1
      projection._id = 1
    }

    const docs = await Product.find(filter, Object.keys(projection).length ? projection : undefined)
      .sort(sortSpec)
      .limit(limit)
      .lean()

    let nextCursor = null
    if (docs.length === limit) {
      const last = docs[docs.length - 1]
      nextCursor = encode({ lastId: last._id })
    }

    res.status(200).json({
      items: docs,
      nextCursor,
      hasMore: Boolean(nextCursor),
    })
  } catch (error) {
    res.status(500).json({ message: "Error fetching products (paginated)", error: error?.message || error })
  }
}

// Fast count with same filters (uses countDocuments(filter))
export const getProductsCount = async (req, res) => {
  try {
    const filter = makeFilter(req.query)
    const count = await Product.countDocuments(filter)
    res.status(200).json({ count })
  } catch (error) {
    res.status(500).json({ message: "Error counting products", error: error?.message || error })
  }
}

// Search options: distinct categories/brands + price range
export const getSearchOptions = async (_req, res) => {
  try {
    // parallelize
    const [categories, brands, minMax] = await Promise.all([
      Product.distinct("category"),
      Product.distinct("brand"),
      Product.aggregate([
        {
          $group: {
            _id: null,
            minPrice: { $min: "$sellPrice" },
            maxPrice: { $max: "$sellPrice" },
          },
        },
        { $project: { _id: 0, minPrice: 1, maxPrice: 1 } },
      ]),
    ])

    const priceRange = minMax?.[0] || { minPrice: null, maxPrice: null }

    res.status(200).json({
      categories: categories.sort(),
      brands: brands.sort(),
      priceRange,
    })
  } catch (error) {
    res.status(500).json({ message: "Error fetching search options", error: error?.message || error })
  }
}

// Optional: quick keyword search (lightweight suggestion list)
export const searchProducts = async (req, res) => {
  try {
    const { q, limit: limitRaw } = req.query;
    if (!q || !q.trim()) return res.status(400).json({ message: 'Query "q" is required' });

    let limit = Number(limitRaw) || 20;
    if (limit < 1) limit = 1;
    if (limit > 50) limit = 50;

    const searchQuery = q.trim();

    const docs = await Product.find(
      {
        $or: [
          { $text: { $search: searchQuery } },            // text: description, brand, category
          { barcode: { $regex: searchQuery, $options: "i" } }, // regex: barcode
        ],
      },
      {
        // include all fields the UI needs:
        _id: 1,
        barcode: 1,
        description: 1,
        category: 1,
        brand: 1,
        purchasePrice: 1,    // <-- add
        sellPrice: 1,
        totalQuantity: 1,    // <-- add
        score: { $meta: "textScore" },
      }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean();

    res.status(200).json({ items: docs });
  } catch (error) {
    res.status(500).json({ message: "Error searching products", error: error?.message || error });
  }
};


// Returns both the filtered product count and the SUM of totalQuantity
export const getProductsSummary = async (req, res) => {
  try {
    const filter = makeFilter(req.query)

    const [count, agg] = await Promise.all([
      Product.countDocuments(filter),
      Product.aggregate([
        { $match: filter },
        { $group: { _id: null, totalQuantity: { $sum: "$totalQuantity" } } },
        { $project: { _id: 0, totalQuantity: 1 } },
      ]),
    ])

    res.status(200).json({
      count, // number of products matching the filters
      totalQuantity: agg[0]?.totalQuantity ?? 0, // sum of stock across the filtered set
    })
  } catch (error) {
    res.status(500).json({ message: "Error computing summary", error: error?.message || error })
  }
}

/**
 * Total products in the collection (unfiltered).
 * Use ?exact=true if you need a precise count (slower on huge collections).
 * Default uses estimatedDocumentCount() which is fast.
 *
 * GET /api/products/total
 * GET /api/products/total?exact=true
 */
export const getTotalProducts = async (req, res) => {
  try {
    const { exact } = req.query

    const total = exact === "true" ? await Product.countDocuments({}) : await Product.estimatedDocumentCount()

    res.status(200).json({
      totalProducts: total,
      method: exact === "true" ? "countDocuments" : "estimatedDocumentCount",
    })
  } catch (error) {
    res.status(500).json({
      message: "Error fetching total products",
      error: error?.message || error,
    })
  }
}

// Total stock value = Σ(purchasePrice * totalQuantity)
export const getTotalStockValue = async (_req, res) => {
  try {
    const result = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: { $multiply: ["$purchasePrice", "$totalQuantity"] },
          },
        },
      },
      { $project: { _id: 0, totalValue: 1 } },
    ])

    res.status(200).json({
      totalStockValue: result[0]?.totalValue ?? 0,
    })
  } catch (error) {
    res.status(500).json({
      message: "Error calculating total stock value",
      error: error?.message || error,
    })
  }
}
