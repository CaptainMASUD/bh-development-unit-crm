import express from "express";
import {
  createProductBrand,
  deleteProductBrand,
  getProductBrand,
  listProductBrandOptions,
  listProductBrands,
  lookupProductBrand,
  restoreProductBrand,
  updateProductBrand,
  updateProductBrandStatus,
} from "../controllers/productBrand.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/options", requirePermission("inventory-brand:view"), listProductBrandOptions);
router.get("/lookup/:code", requirePermission("inventory-brand:view"), lookupProductBrand);
router.get("/", requirePermission("inventory-brand:view"), listProductBrands);
router.post("/", requirePermission("inventory-brand:manage"), createProductBrand);
router.get("/:id", requirePermission("inventory-brand:view"), getProductBrand);
router.patch("/:id", requirePermission("inventory-brand:manage"), updateProductBrand);
router.patch("/:id/status", requirePermission("inventory-brand:manage"), updateProductBrandStatus);
router.patch("/:id/restore", requirePermission("inventory-brand:delete"), restoreProductBrand);
router.delete("/:id", requirePermission("inventory-brand:delete"), deleteProductBrand);

export default router;
