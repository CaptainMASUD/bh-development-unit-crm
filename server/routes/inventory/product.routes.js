import express from "express";

import {
  createProduct,
  deleteProduct,
  getProduct,
  listProductOptions,
  listProducts,
  lookupProduct,
  restoreProduct,
  updateProduct,
  updateProductStatus,
} from "../../controllers/inventory/product.controller.js";

import {
  protect,
  requirePermission,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

/* =========================================================
   OPTIMIZED LIST AND LOOKUP ROUTES
========================================================= */

router.get(
  "/options",
  requirePermission(
    "inventory-product:view"
  ),
  listProductOptions
);

router.get(
  "/lookup/:code",
  requirePermission(
    "inventory-product:view"
  ),
  lookupProduct
);

/* =========================================================
   PRODUCT CRUD
========================================================= */

router.get(
  "/",
  requirePermission(
    "inventory-product:view"
  ),
  listProducts
);

router.post(
  "/",
  requirePermission(
    "inventory-product:manage"
  ),
  createProduct
);

router.get(
  "/:id",
  requirePermission(
    "inventory-product:view"
  ),
  getProduct
);

router.patch(
  "/:id",
  requirePermission(
    "inventory-product:manage"
  ),
  updateProduct
);

router.patch(
  "/:id/status",
  requirePermission(
    "inventory-product:manage"
  ),
  updateProductStatus
);

router.patch(
  "/:id/restore",
  requirePermission(
    "inventory-product:delete"
  ),
  restoreProduct
);

router.delete(
  "/:id",
  requirePermission(
    "inventory-product:delete"
  ),
  deleteProduct
);

export default router;