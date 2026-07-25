import express from "express";
import {
  approveSupplier,
  createSupplier,
  createSupplierProduct,
  deleteSupplier,
  deleteSupplierProduct,
  getSupplier,
  getSupplierProduct,
  getSupplierReferenceData,
  getSupplierSummary,
  listSupplierAudits,
  listSupplierOptions,
  listSupplierProducts,
  listSuppliers,
  lookupSupplier,
  rejectSupplier,
  restoreSupplier,
  restoreSupplierProduct,
  submitSupplier,
  updateSupplier,
  updateSupplierProduct,
  updateSupplierProductStatus,
  updateSupplierStatus,
} from "../controllers/supplier.controller.js";
import {
  protect,
  requireAnyPermission,
  requirePermission,
} from "../middleware/auth.middleware.js";

export const SUPPLIER_PERMISSIONS = Object.freeze({
  VIEW: "supplier:view",
  MANAGE: "supplier:manage",
  APPROVE: "supplier:approve",
  DELETE: "supplier:delete",
});

const router = express.Router();

router.use(protect);

router.get(
  "/meta",
  requirePermission(SUPPLIER_PERMISSIONS.VIEW),
  getSupplierReferenceData
);

router.get(
  "/summary",
  requirePermission(SUPPLIER_PERMISSIONS.VIEW),
  getSupplierSummary
);

router.get(
  "/options",
  requireAnyPermission([
    SUPPLIER_PERMISSIONS.VIEW,
    "inventory-product:manage",
  ]),
  listSupplierOptions
);

router.get(
  "/lookup/:value",
  requirePermission(SUPPLIER_PERMISSIONS.VIEW),
  lookupSupplier
);

router.get(
  "/",
  requirePermission(SUPPLIER_PERMISSIONS.VIEW),
  listSuppliers
);

router.post(
  "/",
  requirePermission(SUPPLIER_PERMISSIONS.MANAGE),
  createSupplier
);

router.get(
  "/:id/audit",
  requirePermission(SUPPLIER_PERMISSIONS.VIEW),
  listSupplierAudits
);

router.get(
  "/:id/products",
  requirePermission(SUPPLIER_PERMISSIONS.VIEW),
  listSupplierProducts
);

router.post(
  "/:id/products",
  requirePermission(SUPPLIER_PERMISSIONS.MANAGE),
  createSupplierProduct
);

router.get(
  "/:id/products/:linkId",
  requirePermission(SUPPLIER_PERMISSIONS.VIEW),
  getSupplierProduct
);

router.patch(
  "/:id/products/:linkId",
  requirePermission(SUPPLIER_PERMISSIONS.MANAGE),
  updateSupplierProduct
);

router.patch(
  "/:id/products/:linkId/status",
  requirePermission(SUPPLIER_PERMISSIONS.MANAGE),
  updateSupplierProductStatus
);

router.patch(
  "/:id/products/:linkId/restore",
  requirePermission(SUPPLIER_PERMISSIONS.DELETE),
  restoreSupplierProduct
);

router.delete(
  "/:id/products/:linkId",
  requirePermission(SUPPLIER_PERMISSIONS.DELETE),
  deleteSupplierProduct
);

router.post(
  "/:id/submit",
  requirePermission(SUPPLIER_PERMISSIONS.MANAGE),
  submitSupplier
);

router.post(
  "/:id/approve",
  requirePermission(SUPPLIER_PERMISSIONS.APPROVE),
  approveSupplier
);

router.post(
  "/:id/reject",
  requirePermission(SUPPLIER_PERMISSIONS.APPROVE),
  rejectSupplier
);

router.patch(
  "/:id/status",
  requirePermission(SUPPLIER_PERMISSIONS.MANAGE),
  updateSupplierStatus
);

router.patch(
  "/:id/restore",
  requirePermission(SUPPLIER_PERMISSIONS.DELETE),
  restoreSupplier
);

router.get(
  "/:id",
  requirePermission(SUPPLIER_PERMISSIONS.VIEW),
  getSupplier
);

router.patch(
  "/:id",
  requirePermission(SUPPLIER_PERMISSIONS.MANAGE),
  updateSupplier
);

router.delete(
  "/:id",
  requirePermission(SUPPLIER_PERMISSIONS.DELETE),
  deleteSupplier
);

export default router;
