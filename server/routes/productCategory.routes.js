import express from "express";
import {
  createProductCategory,
  deleteProductCategory,
  getProductCategory,
  getProductCategoryTree,
  listProductCategories,
  listProductCategoryOptions,
  lookupProductCategory,
  restoreProductCategory,
  updateProductCategory,
  updateProductCategoryStatus,
} from "../controllers/productCategory.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/options", requirePermission("inventory-category:view"), listProductCategoryOptions);
router.get("/tree", requirePermission("inventory-category:view"), getProductCategoryTree);
router.get("/lookup/:value", requirePermission("inventory-category:view"), lookupProductCategory);
router.get("/", requirePermission("inventory-category:view"), listProductCategories);
router.post("/", requirePermission("inventory-category:manage"), createProductCategory);
router.get("/:id", requirePermission("inventory-category:view"), getProductCategory);
router.patch("/:id", requirePermission("inventory-category:manage"), updateProductCategory);
router.patch("/:id/status", requirePermission("inventory-category:manage"), updateProductCategoryStatus);
router.patch("/:id/restore", requirePermission("inventory-category:delete"), restoreProductCategory);
router.delete("/:id", requirePermission("inventory-category:delete"), deleteProductCategory);

export default router;
