import express from "express";
import { protect, requireAnyPermission } from "../../middleware/auth.middleware.js";
import {
  approveRequest,
  completeAnalysis,
  completeQualityInspection,
  createAnalysis,
  createIndustrialPurchaseIssue,
  createQuickPurchase,
  createRequest,
  dashboard,
  finalizeIndustrialPurchaseIssue,
  getAnalysisOptions,
  getDueById,
  getDuePaymentOptions,
  getIndustrialIssueOptions,
  getQuickPurchaseOptions,
  getSupplierOffers,
  listAnalyses,
  listDues,
  listIssues,
  listPriceAnalysis,
  listQuality,
  listRequests,
  payDue,
  purchaseReports,
  recordQualityInspection,
  rejectRequest,
  reviewPriceAnalysis,
  startQualityInspection,
  submitIndustrialPurchaseIssue,
} from "../../controllers/purchaseWorkflow.controller.js";

const router = express.Router();
router.use(protect);

const anyPurchaseView = requireAnyPermission([
  "purchase-order:view",
  "goods-receipt:view",
  "purchase-return:view",
  "purchase-request:view",
  "purchase-analysis:view",
  "purchase-issue:view",
]);

// Dashboard & Reports
router.get("/dashboard", anyPurchaseView, dashboard);
router.get("/reports", anyPurchaseView, purchaseReports);

// Purchase Requests
const reqView = requireAnyPermission(["purchase-request:view", "purchase-order:view"]);
const reqManage = requireAnyPermission(["purchase-request:manage", "purchase-order:manage"]);
const reqApprove = requireAnyPermission(["purchase-request:approve", "purchase-order:approve"]);
router.get("/requests", reqView, listRequests);
router.post("/requests", reqManage, createRequest);
router.post("/requests/:id/approve", reqApprove, approveRequest);
router.post("/requests/:id/reject", reqApprove, rejectRequest);

// Supplier catalogue offers for request product
router.get("/supplier-offers/:productId", reqView, getSupplierOffers);

// Purchase Analyses
const analysisView = requireAnyPermission(["purchase-analysis:view", "purchase-order:view"]);
const analysisManage = requireAnyPermission(["purchase-analysis:manage", "purchase-order:manage"]);
router.get("/analyses", analysisView, listAnalyses);
router.get("/analyses/options", analysisManage, getAnalysisOptions);
router.post("/analyses", analysisManage, createAnalysis);
router.post("/analyses/:id/complete", analysisManage, completeAnalysis);

// Purchase Issues (Industrial & Quick Purchase)
const issueView = requireAnyPermission(["purchase-issue:view", "purchase-order:view"]);
const issueManage = requireAnyPermission(["purchase-issue:manage", "purchase-order:manage"]);
router.get("/issues", issueView, listIssues);
router.get("/industrial-issues/options", issueManage, getIndustrialIssueOptions);
router.post("/industrial-issues", issueManage, createIndustrialPurchaseIssue);
router.post("/industrial-issues/:id/submit", issueManage, submitIndustrialPurchaseIssue);
router.post("/industrial-issues/:id/finalize", issueManage, finalizeIndustrialPurchaseIssue);
router.get("/quick-purchase/options", issueManage, getQuickPurchaseOptions);
router.post("/quick-purchases", issueManage, createQuickPurchase);

// Purchase Dues & Payments
const dueView = requireAnyPermission(["purchase-due:view", "purchase-order:view"]);
const duePay = requireAnyPermission(["purchase-due:pay", "purchase-order:manage"]);
router.get("/dues/options", dueView, getDuePaymentOptions);
router.get("/dues", dueView, listDues);
router.get("/dues/:id", dueView, getDueById);
router.post("/dues/:id/pay", duePay, payDue);

// Quality Inspections
const qualityView = requireAnyPermission(["purchase-quality:view", "goods-receipt:view", "purchase-order:view"]);
const qualityManage = requireAnyPermission(["purchase-quality:manage", "goods-receipt:manage"]);
router.get("/quality-inspections", qualityView, listQuality);
router.post("/quality-inspections/:id/start", qualityManage, startQualityInspection);
router.post("/quality-inspections/:id/results", qualityManage, recordQualityInspection);
router.post("/quality-inspections/:id/complete", qualityManage, completeQualityInspection);

// Price Analysis & Catalogue sync
const priceView = requireAnyPermission(["price-analysis:view", "purchase-order:view"]);
const priceReview = requireAnyPermission(["price-analysis:review", "purchase-order:manage"]);
router.get("/price-analysis", priceView, listPriceAnalysis);
router.post("/price-analysis/:id/review", priceReview, reviewPriceAnalysis);

export default router;
