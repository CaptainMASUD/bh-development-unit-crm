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
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

/**
 * Employee self payroll view
 */
router.get("/me", getMyPayrolls);

/**
 * Admin/Superadmin payroll calculation
 */
router.post("/preview", previewPayroll);
router.post("/calculate", calculatePayroll);
router.post("/bulk-calculate", calculateBulkPayroll);

/**
 * Employee payroll list
 */
router.get("/employee/:employeeId", getEmployeePayrolls);

/**
 * Payroll CRUD/status
 */
router.get("/", listPayrolls);
router.get("/:id", getPayrollById);
router.patch("/:id/approve", approvePayroll);
router.patch("/:id/pay", markPayrollPaid);
router.patch("/:id/cancel", cancelPayroll);
router.delete("/:id", deletePayroll);

export default router;