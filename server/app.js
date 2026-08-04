// app.js
import "./config/tenant.plugin.js";
import express from "express";
import cors from "cors";
import { protect, requireModule } from "./middleware/auth.middleware.js";

const app = express();

// Every operational router is mounted through this boundary. Route-level
// permissions still decide what a user may do inside an enabled module.
const mountModuleRoutes = (path, moduleId, ...routers) => {
  app.use(path, protect, requireModule(moduleId), ...routers);
};

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
import companyRoutes from "./routes/company.routes.js";
import erpModuleRoutes from "./routes/erpModule.routes.js";

// Core CRM
import customerRoutes from "./routes/customer.route.js";
import taskRoutes, { deadlineNotificationRoutes } from "./routes/task.route.js";
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

app.use("/api/companies", companyRoutes);
app.use("/api/erp-modules", erpModuleRoutes);


// =========================
// SUPPLIER MANAGEMENT
// =========================

mountModuleRoutes("/api/suppliers", "supplier", supplierRoutes);


// =========================
// PURCHASE MANAGEMENT
// =========================

mountModuleRoutes("/api/purchase/purchase-orders", "purchase", purchaseOrderRoutes);

mountModuleRoutes("/api/purchase/goods-receipts", "purchase", goodsReceiptRoutes);

mountModuleRoutes("/api/purchase/purchase-returns", "purchase", purchaseReturnRoutes);
/* =========================
   INVENTORY SETUP
========================= */

mountModuleRoutes("/api/inventory/products", "inventory", productRoutes);

mountModuleRoutes("/api/inventory/categories", "inventory", productCategoryRoutes);

mountModuleRoutes("/api/inventory/brands", "inventory", productBrandRoutes);

mountModuleRoutes("/api/inventory/units", "inventory", inventoryUnitRoutes);

mountModuleRoutes("/api/inventory/warehouses", "inventory", warehouseRoutes);

mountModuleRoutes("/api/inventory/warehouse-locations", "inventory", warehouseLocationRoutes);

/* =========================
   INVENTORY OPERATIONS
========================= */

mountModuleRoutes("/api/inventory/stocks", "inventory", productStockRoutes);

mountModuleRoutes("/api/inventory/stock-movements", "inventory", stockMovementRoutes);

mountModuleRoutes("/api/inventory/stock-adjustments", "inventory", stockAdjustmentRoutes);

mountModuleRoutes("/api/inventory/stock-transfers", "inventory", stockTransferRoutes);

mountModuleRoutes("/api/inventory/reports", "inventory", inventoryReportRoutes);

/* =========================
   EMPLOYEE REPORTS
========================= */

mountModuleRoutes("/api/view-preferences/employee-report", "payroll", employeeReportViewPreferenceRoutes);

mountModuleRoutes("/api/employeeReport", "payroll", employeeReportRoutes);

/* =========================
   SALARY PROFILES
========================= */

mountModuleRoutes("/api/salary-profiles", "payroll", salaryProfileRoutes);

/* =========================
   ATTENDANCE
========================= */

mountModuleRoutes("/api/attendance", "payroll", attendanceRoutes);

/* =========================
   HR / EMPLOYEE OPERATIONS
========================= */

mountModuleRoutes("/api/employee-loans", "payroll", employeeLoanRoutes);

mountModuleRoutes("/api/leaves", "payroll", leaveRequestRoutes);

mountModuleRoutes("/api/leave-templates", "payroll", leaveTemplateRoutes);

mountModuleRoutes("/api/tax", "payroll", taxRoutes);

mountModuleRoutes("/api/expenses", "accounting", expenseRoutes);

/* =========================
   ACCOUNTING AND BANKING
========================= */

mountModuleRoutes("/api/accounting", "accounting", accountingRoutes);

mountModuleRoutes("/api/banks", "accounting", bankRoutes);

mountModuleRoutes("/api/banking", "accounting", bankingRoutes);

/* =========================
   PAYROLL
========================= */

mountModuleRoutes("/api/payroll", "payroll", payrollRoutes);

/* =========================
   ROSTER / SHIFT SETUP
========================= */

mountModuleRoutes("/api/roster", "payroll", rosterRoutes);

/* =========================
   CUSTOMER VIEW PREFERENCES
========================= */

mountModuleRoutes("/api/customer-view-preferences", "crm", customerViewPreferenceRoutes);

/* =========================
   SERVICE REPORTS
========================= */

mountModuleRoutes("/api/reports", "crm", serviceReportRoutes);

/* =========================
   CRM SALES MODULES
========================= */

mountModuleRoutes("/api/leads", "crm", leadRoutes);

mountModuleRoutes("/api/activities", "crm", activityRoutes);

mountModuleRoutes("/api/proposals", "crm", proposalRoutes);

mountModuleRoutes("/api/deals", "crm", dealRoutes);

mountModuleRoutes("/api/invoices", "crm", invoiceRoutes);

mountModuleRoutes("/api/lead-messages", "crm", leadMessageRoutes);

/* =========================
   CRM PRODUCTIVITY MODULES
========================= */

mountModuleRoutes("/api/work-queue", "crm", workQueueRoutes);

mountModuleRoutes("/api/automation-rules", "crm", automationRoutes);

mountModuleRoutes("/api/notifications/deadlines", "crm", deadlineNotificationRoutes);

app.use(
  "/api/notifications",
  notificationRoutes
);

mountModuleRoutes("/api/templates", "crm", templateRoutes);

mountModuleRoutes("/api/assignments", "crm", assignmentRoutes);

/* =========================
   WORKLOAD
========================= */

mountModuleRoutes("/api/workload", "crm", workloadRoutes);

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

mountModuleRoutes("/api/task-templates", "crm", taskTemplateRoutes);

mountModuleRoutes("/api/engagement-templates", "crm", engagementTemplateRoutes);

/* =========================
   CORE MODULES
========================= */

mountModuleRoutes("/api/customers", "crm", taskRoutes, reportRoutes, customerRoutes);

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
