import express from "express";
import { protect, requireAnyPermission, requirePermission } from "../../middleware/auth.middleware.js";
import { approveRequest, createAnalysis, createRequest, dashboard, getSupplierOffers, listAnalyses, listDues, listIssues, listPriceAnalysis, listQuality, listRequests, purchaseReports, rejectRequest } from "../../controllers/purchaseWorkflow.controller.js";
const router=express.Router();router.use(protect);
const view=requireAnyPermission(["purchase-order:view","goods-receipt:view","purchase-return:view"]),manage=requireAnyPermission(["purchase-order:manage","goods-receipt:manage"]);
router.get("/dashboard",view,dashboard);router.get("/reports",view,purchaseReports);
router.get("/requests",view,listRequests);router.post("/requests",manage,createRequest);router.post("/requests/:id/approve",requirePermission("purchase-order:approve"),approveRequest);router.post("/requests/:id/reject",requirePermission("purchase-order:approve"),rejectRequest);
router.get("/supplier-offers/:productId",view,getSupplierOffers);router.get("/analyses",view,listAnalyses);router.post("/analyses",manage,createAnalysis);router.get("/issues",view,listIssues);router.get("/dues",view,listDues);router.get("/quality-inspections",view,listQuality);router.get("/price-analysis",view,listPriceAnalysis);
export default router;
