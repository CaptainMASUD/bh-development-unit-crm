// app.js
import express from "express";
import cors from "cors";

const app = express();

/* =========================
   EXPRESS CONFIGURATION
========================= */

// Removes the default Express technology header.
app.disable("x-powered-by");

/*
 * Keep this enabled when the API is deployed behind Vercel,
 * Nginx, Cloudflare, Render, Railway, or another reverse proxy.
 */
app.set("trust proxy", 1);

/* =========================
   CORS
========================= */

const allowedOrigins = new Set([
  "https://businesshub-crm.vercel.app",
  "http://localhost:5173",
]);

app.use(
  cors({
    origin(origin, callback) {
      /*
       * Requests without an Origin header include server-to-server requests,
       * Postman, mobile applications, health checks, and internal calls.
       */
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      const error = new Error("Not allowed by CORS.");
      error.statusCode = 403;

      return callback(error);
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-Id",
      "Idempotency-Key",
    ],

    exposedHeaders: ["X-Request-Id"],

    credentials: true,

    // Cache browser preflight responses for one day.
    maxAge: 86400,

    optionsSuccessStatus: 204,
  })
);

/* =========================
   REQUEST BODY PARSING
========================= */

app.use(
  express.json({
    limit: "2mb",
    strict: true,
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
    parameterLimit: 1000,
  })
);

/* =========================
   ROUTE IMPORTS
========================= */

// Users and uploads
import userRoutes from "./routes/user.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import accessControlRoutes from "./routes/accessControl.routes.js";

// Core CRM
import customerRoutes from "./routes/customer.route.js";
import taskRoutes from "./routes/task.route.js";
import reportRoutes from "./routes/report.route.js";

import leadRoutes from "./routes/lead.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import proposalRoutes from "./routes/proposal.routes.js";
import dealRoutes from "./routes/deal.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import leadMessageRoutes from "./routes/leadMessage.routes.js";

// CRM productivity
import workQueueRoutes from "./routes/workQueue.routes.js";
import automationRoutes from "./routes/automation.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import templateRoutes from "./routes/template.routes.js";
import assignmentRoutes from "./routes/assignment.routes.js";
import taskTemplateRoutes from "./routes/taskTemplate.route.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import engagementTemplateRoutes from "./routes/engagementTemplate.route.js";
import workloadRoutes from "./routes/workload.route.js";

// Preferences and settings
import viewPreferenceRoutes from "./routes/viewPreference.routes.js";
import purchaseTypeRoutes from "./routes/purchaseType.routes.js";
import customerViewPreferenceRoutes from "./routes/customerViewPreference.routes.js";

// Reports
import serviceReportRoutes from "./routes/serviceReport.route.js";
import employeeReportRoutes from "./routes/employeeReport.route.js";
import employeeReportViewPreferenceRoutes from "./routes/employeeReportViewPreference.route.js";

// HR, payroll and attendance
import salaryProfileRoutes from "./routes/salaryProfile.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import payrollRoutes from "./routes/payroll.routes.js";
import employeeLoanRoutes from "./routes/employeeLoan.routes.js";
import rosterRoutes from "./routes/roster.routes.js";
import leaveRequestRoutes from "./routes/leaveRequest.routes.js";
import leaveTemplateRoutes from "./routes/leaveTemplate.routes.js";
import taxRoutes from "./routes/tax.routes.js";
import expenseRoutes from "./routes/expense.routes.js";

// Accounting and banking
import accountingRoutes from "./routes/accounting.routes.js";
import bankRoutes from "./routes/bank.routes.js";
import bankingRoutes from "./routes/banking.routes.js";

// Inventory setup
import productRoutes from "./routes/inventory/product.routes.js";
import productCategoryRoutes from "./routes/inventory/productCategory.routes.js";
import productBrandRoutes from "./routes/inventory/productBrand.routes.js";
import inventoryUnitRoutes from "./routes/inventory/inventoryUnit.routes.js";
import warehouseRoutes from "./routes/inventory/warehouse.routes.js";
import warehouseLocationRoutes from "./routes/inventory/warehouseLocation.routes.js";

// Inventory operations
import productStockRoutes from "./routes/inventory/productStock.routes.js";
import stockMovementRoutes from "./routes/inventory/stockMovement.routes.js";
import stockAdjustmentRoutes from "./routes/inventory/stockAdjustment.routes.js";
import stockTransferRoutes from "./routes/inventory/stockTransfer.routes.js";
import inventoryReportRoutes from "./routes/inventory/inventoryReport.routes.js";

// =========================
// PURCHASE & SUPPLIERS
// =========================
import supplierRoutes from "./routes/supplier.routes.js";

import purchaseOrderRoutes from "./routes/purchaseOrder.routes.js";
import goodsReceiptRoutes from "./routes/goodsReceipt.routes.js";
import purchaseReturnRoutes from "./routes/purchaseReturn.routes.js";

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "BusinessHub ERP API is running",
    timestamp: new Date().toISOString(),
  });
});


// =========================
// SUPPLIER MANAGEMENT
// =========================

app.use("/api/suppliers", supplierRoutes);


// =========================
// PURCHASE MANAGEMENT
// =========================

app.use(
  "/api/purchase/purchase-orders",
  purchaseOrderRoutes
);

app.use(
  "/api/purchase/goods-receipts",
  goodsReceiptRoutes
);

app.use(
  "/api/purchase/purchase-returns",
  purchaseReturnRoutes
);
/* =========================
   INVENTORY SETUP
========================= */

app.use(
  "/api/inventory/products",
  productRoutes
);

app.use(
  "/api/inventory/categories",
  productCategoryRoutes
);

app.use(
  "/api/inventory/brands",
  productBrandRoutes
);

app.use(
  "/api/inventory/units",
  inventoryUnitRoutes
);

app.use(
  "/api/inventory/warehouses",
  warehouseRoutes
);

app.use(
  "/api/inventory/warehouse-locations",
  warehouseLocationRoutes
);

/* =========================
   INVENTORY OPERATIONS
========================= */

app.use(
  "/api/inventory/stocks",
  productStockRoutes
);

app.use(
  "/api/inventory/stock-movements",
  stockMovementRoutes
);

app.use(
  "/api/inventory/stock-adjustments",
  stockAdjustmentRoutes
);

app.use(
  "/api/inventory/stock-transfers",
  stockTransferRoutes
);

app.use(
  "/api/inventory/reports",
  inventoryReportRoutes
);

/* =========================
   EMPLOYEE REPORTS
========================= */

app.use(
  "/api/view-preferences/employee-report",
  employeeReportViewPreferenceRoutes
);

app.use(
  "/api/employeeReport",
  employeeReportRoutes
);

/* =========================
   SALARY PROFILES
========================= */

app.use(
  "/api/salary-profiles",
  salaryProfileRoutes
);

/* =========================
   ATTENDANCE
========================= */

app.use(
  "/api/attendance",
  attendanceRoutes
);

/* =========================
   HR / EMPLOYEE OPERATIONS
========================= */

app.use(
  "/api/employee-loans",
  employeeLoanRoutes
);

app.use(
  "/api/leaves",
  leaveRequestRoutes
);

app.use(
  "/api/leave-templates",
  leaveTemplateRoutes
);

app.use(
  "/api/tax",
  taxRoutes
);

app.use(
  "/api/expenses",
  expenseRoutes
);

/* =========================
   ACCOUNTING AND BANKING
========================= */

app.use(
  "/api/accounting",
  accountingRoutes
);

app.use(
  "/api/banks",
  bankRoutes
);

app.use(
  "/api/banking",
  bankingRoutes
);

/* =========================
   PAYROLL
========================= */

app.use(
  "/api/payroll",
  payrollRoutes
);

/* =========================
   ROSTER / SHIFT SETUP
========================= */

app.use(
  "/api/roster",
  rosterRoutes
);

/* =========================
   CUSTOMER VIEW PREFERENCES
========================= */

app.use(
  "/api/customer-view-preferences",
  customerViewPreferenceRoutes
);

/* =========================
   SERVICE REPORTS
========================= */

app.use(
  "/api/reports",
  serviceReportRoutes
);

/* =========================
   CRM SALES MODULES
========================= */

app.use(
  "/api/leads",
  leadRoutes
);

app.use(
  "/api/activities",
  activityRoutes
);

app.use(
  "/api/proposals",
  proposalRoutes
);

app.use(
  "/api/deals",
  dealRoutes
);

app.use(
  "/api/invoices",
  invoiceRoutes
);

app.use(
  "/api/lead-messages",
  leadMessageRoutes
);

/* =========================
   CRM PRODUCTIVITY MODULES
========================= */

app.use(
  "/api/work-queue",
  workQueueRoutes
);

app.use(
  "/api/automation-rules",
  automationRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use(
  "/api/templates",
  templateRoutes
);

app.use(
  "/api/assignments",
  assignmentRoutes
);

/* =========================
   WORKLOAD
========================= */

app.use(
  "/api/workload",
  workloadRoutes
);

/* =========================
   DASHBOARD
========================= */

app.use(
  "/api/dashboard",
  dashboardRoutes
);

/* =========================
   TEMPLATES
========================= */

app.use(
  "/api",
  taskTemplateRoutes
);

app.use(
  "/api/engagement-templates",
  engagementTemplateRoutes
);

/* =========================
   CORE MODULES
========================= */

app.use(
  "/api/customers",
  customerRoutes
);

app.use(
  "/api",
  taskRoutes
);

app.use(
  "/api",
  reportRoutes
);

/* =========================
   UPLOAD / USERS / ACCESS
========================= */

app.use(
  "/api/upload",
  uploadRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/access-control",
  accessControlRoutes
);

/* =========================
   SETTINGS
========================= */

app.use(
  "/api/view-preferences",
  viewPreferenceRoutes
);

app.use(
  "/api/purchase-types",
  purchaseTypeRoutes
);

/* =========================
   404 HANDLER
========================= */

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = Number.isInteger(err?.statusCode)
    ? err.statusCode
    : 500;

  const isProduction =
    process.env.NODE_ENV === "production";

  const response = {
    success: false,
    statusCode,
    message:
      err?.message ||
      "Internal server error",
  };

  /*
   * Stack traces are only returned during development.
   */
  if (!isProduction) {
    response.stack = err?.stack;
  }

  return res
    .status(statusCode)
    .json(response);
});

export { app };