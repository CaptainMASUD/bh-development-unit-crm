// app.js
import express from "express";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: ["https://businesshub-crm.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

/* =========================
   ROUTE IMPORTS
========================= */
import userRoutes from "./routes/user.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

import customerRoutes from "./routes/customer.route.js";
import taskRoutes from "./routes/task.route.js";
import reportRoutes from "./routes/report.route.js";

import leadRoutes from "./routes/lead.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import proposalRoutes from "./routes/proposal.routes.js";
import dealRoutes from "./routes/deal.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import leadMessageRoutes from "./routes/leadMessage.routes.js";

import workQueueRoutes from "./routes/workQueue.routes.js";
import automationRoutes from "./routes/automation.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import templateRoutes from "./routes/template.routes.js";
import assignmentRoutes from "./routes/assignment.routes.js";

import taskTemplateRoutes from "./routes/taskTemplate.route.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import engagementTemplateRoutes from "./routes/engagementTemplate.route.js";
import workloadRoutes from "./routes/workload.route.js";

import viewPreferenceRoutes from "./routes/viewPreference.routes.js";
import purchaseTypeRoutes from "./routes/purchaseType.routes.js";

import serviceReportRoutes from "./routes/serviceReport.route.js";
import customerViewPreferenceRoutes from "./routes/customerViewPreference.routes.js";

import employeeReportRoutes from "./routes/employeeReport.route.js";
import employeeReportViewPreferenceRoutes from "./routes/employeeReportViewPreference.route.js";
import accessControlRoutes from "./routes/accessControl.routes.js";
import salaryProfileRoutes from "./routes/salaryProfile.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import payrollRoutes from "./routes/payroll.routes.js";
import employeeLoanRoutes from "./routes/employeeLoan.routes.js";
import rosterRoutes from "./routes/roster.routes.js";
import leaveRequestRoutes from "./routes/leaveRequest.routes.js";
import leaveTemplateRoutes from "./routes/leaveTemplate.routes.js";
import taxRoutes from "./routes/tax.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import accountingRoutes from "./routes/accounting.routes.js";

/* =========================
   HEALTH CHECK
========================= */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "BusinessHub CRM API is running",
  });
});

/* =========================
   EMPLOYEE REPORTS
========================= */
app.use("/api/view-preferences/employee-report", employeeReportViewPreferenceRoutes);
app.use("/api/employeeReport", employeeReportRoutes);

/* =========================
   SALARY PROFILES
========================= */
app.use("/api/salary-profiles", salaryProfileRoutes);

/* =========================
   ATTENDANCE
========================= */
app.use("/api/attendance", attendanceRoutes);

/* =========================
   EMPLOYEE LOANS
========================= */
app.use("/api/employee-loans", employeeLoanRoutes);
app.use("/api/leaves", leaveRequestRoutes);
app.use("/api/leave-templates", leaveTemplateRoutes);
app.use("/api/tax", taxRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/accounting", accountingRoutes);

/* =========================
   PAYROLL
========================= */
app.use("/api/payroll", payrollRoutes);

/* =========================
   ROSTER / SHIFT SETUP
========================= */
app.use("/api/roster", rosterRoutes);

/* =========================
   CUSTOMER VIEW PREFERENCES
========================= */
app.use("/api/customer-view-preferences", customerViewPreferenceRoutes);

/* =========================
   SERVICE REPORTS
========================= */
app.use("/api/reports", serviceReportRoutes);

/* =========================
   CRM SALES MODULES - OLD UPDATED
========================= */
app.use("/api/leads", leadRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/lead-messages", leadMessageRoutes);

/* =========================
   CRM PRODUCTIVITY MODULES - NEW
========================= */
app.use("/api/work-queue", workQueueRoutes);
app.use("/api/automation-rules", automationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/assignments", assignmentRoutes);

/* =========================
   WORKLOAD
========================= */
app.use("/api/workload", workloadRoutes);

/* =========================
   DASHBOARD
========================= */
app.use("/api/dashboard", dashboardRoutes);

/* =========================
   TEMPLATES
========================= */
app.use("/api", taskTemplateRoutes);
app.use("/api/engagement-templates", engagementTemplateRoutes);

/* =========================
   CORE MODULES
========================= */
app.use("/api/customers", customerRoutes);
app.use("/api", taskRoutes);
app.use("/api", reportRoutes);

/* =========================
   UPLOAD / USERS / SETTINGS
========================= */
app.use("/api/upload", uploadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/access-control", accessControlRoutes);

app.use("/api/view-preferences", viewPreferenceRoutes);
app.use("/api/purchase-types", purchaseTypeRoutes);

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});

export { app };
