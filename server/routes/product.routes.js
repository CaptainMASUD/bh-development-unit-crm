// routes/product.routes.js
import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  toggleProductActive,
  deleteProduct,
} from "../controllers/product.controller.js";

import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

// list/search products (used for deal/order items)
router.get("/", getProducts);
router.get("/:id", getProductById);

// admin-only management
router.post("/", isAdminOrSuperAdmin, createProduct);
router.patch("/:id", isAdminOrSuperAdmin, updateProduct);
router.patch("/:id/active", isAdminOrSuperAdmin, toggleProductActive);
router.delete("/:id", isAdminOrSuperAdmin, deleteProduct);

export default router;
