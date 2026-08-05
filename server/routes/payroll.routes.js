import express from "express";
import {
  approvePayroll,
  calculateBulkPayroll,
  calculatePayroll,
  cancelPayroll,
  deletePayroll,
  getEmployeePayrolls,
  getMyPayrolls,
  getPayrollById,
  listPayrolls,
  markPayrollPaid,
  previewPayroll,
} from "../controllers/payroll.controller.js";
import { protect, requireAnyPermission, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

/**
 * Employee self payroll view
 */
router.get("/me", requirePermission("payroll:view"), getMyPayrolls);

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
 * Payroll CRUD/status
 */
router.get("/", requirePermission("payroll:manage"), listPayrolls);
router.get("/:id", requireAnyPermission(["payroll:view", "payroll:manage"]), getPayrollById);
router.patch("/:id/approve", requirePermission("payroll:manage"), approvePayroll);
router.patch("/:id/pay", requirePermission("payroll:manage"), markPayrollPaid);
router.patch("/:id/cancel", requirePermission("payroll:manage"), cancelPayroll);
router.delete("/:id", requirePermission("payroll:manage"), deletePayroll);

export default router;
