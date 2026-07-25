import express from "express";
import {
  getCurrentStockReport,
  getInventoryDashboard,
  getLowStockReport,
  getProductStockLedger,
  getStockMovementReport,
  getStockValuationReport,
  getWarehouseStockSummary,
} from "../../controllers/inventory/inventoryReport.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/dashboard", requirePermission("inventory-report:view"), getInventoryDashboard);
router.get("/current-stock", requirePermission("inventory-report:view"), getCurrentStockReport);
router.get("/valuation", requirePermission("inventory-report:view"), getStockValuationReport);
router.get("/low-stock", requirePermission("inventory-report:view"), getLowStockReport);
router.get("/warehouse-summary", requirePermission("inventory-report:view"), getWarehouseStockSummary);
router.get("/movements", requirePermission("inventory-report:view"), getStockMovementReport);
router.get("/ledger/:productId", requirePermission("inventory-report:view"), getProductStockLedger);

export default router;
