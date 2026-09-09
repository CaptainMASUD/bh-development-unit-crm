import express from "express";
import {
  getCurrentStockReport,
  getInventoryDashboard,
  getLowStockReport,
  getProductStockLedger,
  getStockMovementReport,
  getStockValuationReport,
  getWarehouseStockReport,
  getWarehouseStockSummary,
  getInventoryGlReconciliation,
  getLocationStockReport,
  getAvailableVsReservedReport,
  getStockAgingReport,
  getSlowMovingReport,
  getBatchExpiryReport,
  getSerialNumberReport,
  getStockAdjustmentReport,
  getStockCountReport,
  getStockTransferReport,
  getInventoryLossReport,
  getInventoryIntegrityCheck,
  executeInventoryRepair,
  exportInventoryReport,
} from "../../controllers/inventory/inventoryReport.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

// Dashboard & Core Operational Reports
router.get("/dashboard", requirePermission("inventory-report:view"), getInventoryDashboard);
router.get("/current-stock", requirePermission("inventory-report:view"), getCurrentStockReport);
router.get("/valuation", requirePermission("inventory-report:view"), getStockValuationReport);
router.get("/low-stock", requirePermission("inventory-report:view"), getLowStockReport);
router.get("/warehouse-summary", requirePermission("inventory-report:view"), getWarehouseStockSummary);
router.get("/warehouse-stock", requirePermission("inventory-report:view"), getWarehouseStockReport);
router.get("/location-stock", requirePermission("inventory-report:view"), getLocationStockReport);
router.get("/available-vs-reserved", requirePermission("inventory-report:view"), getAvailableVsReservedReport);
router.get("/movements", requirePermission("inventory-report:view"), getStockMovementReport);
router.get("/ledger/:productId", requirePermission("inventory-report:view"), getProductStockLedger);
router.get("/aging", requirePermission("inventory-report:view"), getStockAgingReport);
router.get("/slow-moving", requirePermission("inventory-report:view"), getSlowMovingReport);
router.get("/batch-expiry", requirePermission("inventory-report:view"), getBatchExpiryReport);
router.get("/serial-numbers", requirePermission("inventory-report:view"), getSerialNumberReport);
router.get("/adjustments", requirePermission("inventory-report:view"), getStockAdjustmentReport);
router.get("/stock-counts", requirePermission("inventory-report:view"), getStockCountReport);
router.get("/transfers", requirePermission("inventory-report:view"), getStockTransferReport);
router.get("/losses", requirePermission("inventory-report:view"), getInventoryLossReport);

// Inventory <-> GL Reconciliation
router.get("/gl-reconciliation", requirePermission("inventory-reconciliation:view"), getInventoryGlReconciliation);

// Administrative Integrity & Repair Tools
router.get("/integrity-check", requirePermission("inventory-integrity:view"), getInventoryIntegrityCheck);
router.post("/repair", requirePermission("inventory-integrity:manage"), executeInventoryRepair);

// Streaming Export
router.get("/export/:reportType", requirePermission("inventory-report:export"), exportInventoryReport);

export default router;
