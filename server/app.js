// app.js
import "./config/tenant.plugin.js";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { protect, requireModule } from "./middleware/auth.middleware.js";
import { getMongoTransactionCapability } from "./utils/mongoTransaction.js";

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

// Administration and platform
import userRoutes from "./routes/administration/user.routes.js";
import uploadRoutes from "./routes/administration/upload.routes.js";
import accessControlRoutes from "./routes/administration/accessControl.routes.js";
import companyRoutes from "./routes/administration/company.routes.js";
import erpModuleRoutes from "./routes/administration/erpModule.routes.js";
import notificationRoutes from "./routes/administration/notification.routes.js";
import administrationRoutes from "./routes/administration/administration.routes.js";

// Core CRM
import customerRoutes from "./routes/crm/customer.route.js";
import taskRoutes, { deadlineNotificationRoutes } from "./routes/crm/task.route.js";
import reportRoutes from "./routes/crm/report.route.js";

import leadRoutes from "./routes/crm/lead.routes.js";
import activityRoutes from "./routes/crm/activity.routes.js";
import proposalRoutes from "./routes/crm/proposal.routes.js";
import dealRoutes from "./routes/crm/deal.routes.js";
import invoiceRoutes from "./routes/crm/invoice.routes.js";
import leadMessageRoutes from "./routes/crm/leadMessage.routes.js";

// CRM productivity
import workQueueRoutes from "./routes/crm/workQueue.routes.js";
import automationRoutes from "./routes/crm/automation.routes.js";
import templateRoutes from "./routes/crm/template.routes.js";
import assignmentRoutes from "./routes/crm/assignment.routes.js";
import taskTemplateRoutes from "./routes/crm/taskTemplate.route.js";
import dashboardRoutes from "./routes/crm/dashboard.routes.js";
import engagementTemplateRoutes from "./routes/crm/engagementTemplate.route.js";
import workloadRoutes from "./routes/crm/workload.route.js";

// Preferences and settings
import viewPreferenceRoutes from "./routes/crm/viewPreference.routes.js";
import purchaseTypeRoutes from "./routes/purchase/purchaseType.routes.js";
import customerViewPreferenceRoutes from "./routes/crm/customerViewPreference.routes.js";

// Reports
import serviceReportRoutes from "./routes/crm/serviceReport.route.js";
import employeeReportRoutes from "./routes/payroll/employeeReport.route.js";
import employeeReportViewPreferenceRoutes from "./routes/payroll/employeeReportViewPreference.route.js";

// HR, payroll and attendance
import salaryGradeRoutes from "./routes/payroll/salaryGrade.routes.js";
import salaryProfileRoutes from "./routes/payroll/salaryProfile.routes.js";
import attendanceRoutes from "./routes/payroll/attendance.routes.js";
import payrollRoutes from "./routes/payroll/payroll.routes.js";
import employeeLoanRoutes from "./routes/payroll/employeeLoan.routes.js";
import rosterRoutes from "./routes/payroll/roster.routes.js";
import leaveRequestRoutes from "./routes/payroll/leaveRequest.routes.js";
import leaveTemplateRoutes from "./routes/payroll/leaveTemplate.routes.js";
import taxRoutes from "./routes/accounting/tax.routes.js";
import expenseRoutes from "./routes/accounting/expense.routes.js";

// Accounting and banking
import accountingRoutes from "./routes/accounting/accounting.routes.js";
import bankRoutes from "./routes/accounting/bank.routes.js";
import bankingRoutes from "./routes/accounting/banking.routes.js";

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
import inventoryRevaluationRoutes from "./routes/inventory/inventoryRevaluation.routes.js";
import inventoryOperationsRoutes from "./routes/inventory/inventoryOperations.routes.js";

// =========================
// PURCHASE & SUPPLIERS
// =========================
import supplierRoutes from "./routes/supplier/supplier.routes.js";

import purchaseOrderRoutes from "./routes/purchase/purchaseOrder.routes.js";
import commercialLCRoutes from "./routes/purchase/commercialLC.routes.js";
import goodsReceiptRoutes from "./routes/purchase/goodsReceipt.routes.js";
import purchaseReturnRoutes from "./routes/purchase/purchaseReturn.routes.js";
import purchaseWorkflowRoutes from "./routes/purchase/purchaseWorkflow.routes.js";
import salesRoutes from "./routes/sales/sales.routes.js";
import manufacturingRoutes from "./routes/manufacturing/manufacturing.routes.js";

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "BusinessHub ERP API",
    message: "BusinessHub ERP backend is online.",
    version: "1.0.0",
    health: "/api/health",
    readiness: "/api/ready",
    timestamp: new Date().toISOString(),
  });
});

// Liveness intentionally has no external dependency. Infrastructure can use
// this endpoint to determine whether the Node process/function is responsive.
app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "alive",
    message: "BusinessHub ERP API is running",
    timestamp: new Date().toISOString(),
  });
});

// Readiness verifies the database and the transaction guarantees required by
// financial and inventory writes. A failed check returns 503 so traffic can be
// retried instead of reaching a partially initialized application.
app.get("/api/ready", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      throw new Error("MongoDB is disconnected.");
    }

    await mongoose.connection.db.admin().command({ ping: 1 });
    const transactions = await getMongoTransactionCapability();
    return res.status(200).json({
      success: true,
      status: "ready",
      database: "connected",
      transactions: {
        mode: transactions.mode,
        topology: transactions.topology,
        supported: transactions.supported,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: "not-ready",
      database: mongoose.connection.readyState === 1 ? "unavailable" : "disconnected",
      message: "BusinessHub ERP API is temporarily unavailable.",
      timestamp: new Date().toISOString(),
    });
  }
});

app.use("/api/companies", companyRoutes);
app.use("/api/erp-modules", erpModuleRoutes);
app.use("/api/administration", administrationRoutes);


// =========================
// SUPPLIER MANAGEMENT
// =========================

mountModuleRoutes("/api/suppliers", "supplier", supplierRoutes);


// =========================
// PURCHASE MANAGEMENT
// =========================

mountModuleRoutes("/api/purchase/purchase-orders", "purchase", purchaseOrderRoutes);

mountModuleRoutes("/api/purchase/commercial-lcs", "purchase", commercialLCRoutes);

mountModuleRoutes("/api/purchase/goods-receipts", "purchase", goodsReceiptRoutes);

mountModuleRoutes("/api/purchase/purchase-returns", "purchase", purchaseReturnRoutes);

mountModuleRoutes("/api/purchase/workflow", "purchase", purchaseWorkflowRoutes);

/* =========================
   SALES MODULE
========================= */

mountModuleRoutes("/api/sales", "sales", salesRoutes);

/* =========================
   MANUFACTURING MODULE
========================= */

mountModuleRoutes("/api/manufacturing", "manufacturing", manufacturingRoutes);
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

mountModuleRoutes("/api/inventory/revaluations", "inventory", inventoryRevaluationRoutes);

mountModuleRoutes("/api/inventory/reports", "inventory", inventoryReportRoutes);

mountModuleRoutes("/api/inventory/operations", "inventory", inventoryOperationsRoutes);

/* =========================
   EMPLOYEE REPORTS
========================= */

mountModuleRoutes("/api/view-preferences/employee-report", "payroll", employeeReportViewPreferenceRoutes);

mountModuleRoutes("/api/employeeReport", "payroll", employeeReportRoutes);

/* =========================
   SALARY PROFILES
========================= */

mountModuleRoutes("/api/salary-grades", "payroll", salaryGradeRoutes);
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
mountModuleRoutes("/api/payrolls", "payroll", payrollRoutes);

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

export default app;
export { app };
