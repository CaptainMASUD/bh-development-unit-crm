import express from "express";
import {
  approvePayroll,
  bulkDownloadPayslips,
  calculateBulkPayroll,
  calculatePayroll,
  cancelPayroll,
  deletePayroll,
  downloadPayslipPdf,
  exportDisbursementAdvice,
  exportPayrollRegister,
  getEmployeePayrolls,
  getMyPayrolls,
  getPayrollAuditHistory,
  getPayrollAuditLogs,
  getPayrollById,
  getPayrollPeriodStatus,
  getPayslip,
  listPayrollPeriods,
  listPayrolls,
  lockPayrollPeriod,
  markPayrollPaid,
  previewPayroll,
  reversePayroll,
  unlockPayrollPeriod,
} from "../../controllers/payroll.controller.js";
import {
  getApprovalWorkflow,
  updateApprovalWorkflow,
  submitPayrollForApproval,
  bulkSubmitPayrollForApproval,
  approvePayrollStage,
  sendBackPayroll,
  rejectPayroll,
  bulkApprovePayrollStage,
  getPayrollApprovalHistory,
  listPayrollApprovals,
} from "../../controllers/payroll/payrollApproval.controller.js";
import {
  createDepartment,
  createPosition,
  deleteDepartment,
  deletePosition,
  listDepartments,
  listPositions,
  updateDepartment,
  updatePosition,
} from "../../controllers/accessControl.controller.js";
import { protect, requireAnyPermission, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

/**
 * Employee self payroll view
 */
router.get("/me", requirePermission("payroll:view"), getMyPayrolls);

/**
 * Period management
 */
router.get("/periods", requirePermission("payroll:manage"), listPayrollPeriods);
router.get("/periods/:year/:month", requirePermission("payroll:manage"), getPayrollPeriodStatus);
router.post("/periods/:year/:month/lock", requirePermission("payroll:manage"), lockPayrollPeriod);
router.post("/periods/:year/:month/unlock", requirePermission("payroll:manage"), unlockPayrollPeriod);

/**
 * Audit history & logs
 */
router.get("/audit-logs", requirePermission("payroll:manage"), getPayrollAuditLogs);

/**
 * Admin/Superadmin payroll calculation
 */
router.post("/preview", requirePermission("payroll:manage"), previewPayroll);
router.post("/calculate", requirePermission("payroll:manage"), calculatePayroll);
router.post("/bulk-calculate", requirePermission("payroll:manage"), calculateBulkPayroll);

/**
 * Employee payroll list
 */
router.get("/employee/:employeeId", requireAnyPermission(["payroll:view", "payroll:manage"]), getEmployeePayrolls);

/**
 * Phase 3 — Static Export & Bulk Payslip routes (MUST be declared before /:id)
 */
router.post("/payslips/bulk-download", requirePermission("payroll:manage"), bulkDownloadPayslips);
router.get("/export/register", requirePermission("payroll:manage"), exportPayrollRegister);
router.get("/export/disbursement-advice", requirePermission("payroll:manage"), exportDisbursementAdvice);

/**
 * Phase 4 — Approval Workflow Configuration & Multi-stage Approvals (Static routes before /:id)
 */
router.get("/approval-workflow", requireAnyPermission(["payroll:manage", "payroll:workflow_configure"]), getApprovalWorkflow);
router.put("/approval-workflow", requireAnyPermission(["payroll:manage", "payroll:workflow_configure"]), updateApprovalWorkflow);
router.patch("/approval-workflow", requireAnyPermission(["payroll:manage", "payroll:workflow_configure"]), updateApprovalWorkflow);
router.get("/approvals", requireAnyPermission(["payroll:manage", "payroll:review", "payroll:approve"]), listPayrollApprovals);
router.post("/approvals/bulk-submit", requirePermission("payroll:manage"), bulkSubmitPayrollForApproval);
router.post("/approvals/bulk-approve", requireAnyPermission(["payroll:manage", "payroll:review", "payroll:approve"]), bulkApprovePayrollStage);

/**
 * Payroll CRUD/status/reversal/payslips
 */
router.get("/", requirePermission("payroll:manage"), listPayrolls);
router.get("/:id/payslip", requireAnyPermission(["payroll:view", "payroll:manage"]), getPayslip);
router.get("/:id/payslip/pdf", requireAnyPermission(["payroll:view", "payroll:manage"]), downloadPayslipPdf);
router.get("/:id", requireAnyPermission(["payroll:view", "payroll:manage"]), getPayrollById);
router.get("/:id/audit-history", requireAnyPermission(["payroll:view", "payroll:manage"]), getPayrollAuditHistory);
router.get("/:id/approval-history", requireAnyPermission(["payroll:view", "payroll:manage", "payroll:review", "payroll:approve"]), getPayrollApprovalHistory);
router.post("/:id/submit-approval", requireAnyPermission(["payroll:manage", "payroll:review"]), submitPayrollForApproval);
router.patch("/:id/submit-approval", requireAnyPermission(["payroll:manage", "payroll:review"]), submitPayrollForApproval);
router.post("/:id/approve", requireAnyPermission(["payroll:manage", "payroll:approve", "payroll:review"]), approvePayrollStage);
router.patch("/:id/approve", requireAnyPermission(["payroll:manage", "payroll:approve", "payroll:review"]), approvePayrollStage);
router.post("/:id/send-back", requireAnyPermission(["payroll:manage", "payroll:review", "payroll:approve"]), sendBackPayroll);
router.post("/:id/reject", requireAnyPermission(["payroll:manage", "payroll:review", "payroll:approve"]), rejectPayroll);
router.patch("/:id/pay", requireAnyPermission(["payroll:manage", "payroll:disburse"]), markPayrollPaid);
router.post("/:id/pay", requireAnyPermission(["payroll:manage", "payroll:disburse"]), markPayrollPaid);
router.patch("/:id/reverse", requirePermission("payroll:manage"), reversePayroll);
router.patch("/:id/cancel", requirePermission("payroll:manage"), cancelPayroll);
router.delete("/:id", requirePermission("payroll:manage"), deletePayroll);

/**
 * Organizational structure: Departments & Positions
 */
router.get("/departments", requireAnyPermission(["employees:view", "payroll:view", "access-control:view"]), listDepartments);
router.post("/departments", requireAnyPermission(["employees:manage", "payroll:manage", "access-control:manage"]), createDepartment);
router.patch("/departments/:id", requireAnyPermission(["employees:manage", "payroll:manage", "access-control:manage"]), updateDepartment);
router.delete("/departments/:id", requireAnyPermission(["employees:manage", "payroll:manage", "access-control:manage"]), deleteDepartment);

router.get("/positions", requireAnyPermission(["employees:view", "payroll:view", "access-control:view"]), listPositions);
router.post("/positions", requireAnyPermission(["employees:manage", "payroll:manage", "access-control:manage"]), createPosition);
router.patch("/positions/:id", requireAnyPermission(["employees:manage", "payroll:manage", "access-control:manage"]), updatePosition);
router.delete("/positions/:id", requireAnyPermission(["employees:manage", "payroll:manage", "access-control:manage"]), deletePosition);

export default router;
