import express from "express";
import { protect, requireAnyPermission, requirePermission } from "../../middleware/auth.middleware.js";
import { approveStockRequest, assignPendingInventory, completeInspection, createInspection, createPendingInventory, createStockRequest, createWarehouseCheck, getPreferences, inventoryOverview, issueStockRequest, listConsumption, listInspections, listLosses, listPendingInventory, listStockRequests, listTracking, listWarehouseChecks, rejectStockRequest, setWarehouseCheckStatus, updatePreferences, updateTrackingState } from "../../controllers/inventory/inventoryOperations.controller.js";

const router = express.Router();
router.use(protect);
const view = requireAnyPermission(["inventory-stock:view", "inventory-report:view", "inventory-movement:view"]);
const manage = requireAnyPermission(["inventory-stock:manage", "inventory-movement:manage"]);

router.get("/overview", view, inventoryOverview);
router.get("/preferences", view, getPreferences);
router.patch("/preferences", manage, updatePreferences);
router.get("/pending-inventory", view, listPendingInventory);
router.post("/pending-inventory", manage, createPendingInventory);
router.post("/pending-inventory/:id/assign", requirePermission("inventory-movement:post"), assignPendingInventory);
router.get("/requests", view, listStockRequests);
router.post("/requests", manage, createStockRequest);
router.post("/requests/:id/approve", requirePermission("inventory-adjustment:approve"), approveStockRequest);
router.post("/requests/:id/reject", requirePermission("inventory-adjustment:approve"), rejectStockRequest);
router.post("/requests/:id/issue", requirePermission("inventory-movement:post"), issueStockRequest);
router.get("/tracking", view, listTracking);
router.patch("/tracking/:id/state", manage, updateTrackingState);
router.get("/consumption", view, listConsumption);
router.get("/losses", requirePermission("inventory-report:view"), listLosses);
router.get("/inspections", view, listInspections);
router.post("/inspections", manage, createInspection);
router.post("/inspections/:id/complete", requirePermission("inventory-adjustment:post"), completeInspection);
router.get("/warehouse-checks", view, listWarehouseChecks);
router.post("/warehouse-checks", manage, createWarehouseCheck);
router.patch("/warehouse-checks/:id/status", manage, setWarehouseCheckStatus);

export default router;
