import express from "express";
import {
  addManualLoanPayment,
  cancelEmployeeLoan,
  createEmployeeLoan,
  getEmployeeLoanById,
  getEmployeeLoansByEmployee,
  getMyEmployeeLoans,
  listEmployeeLoans,
  updateEmployeeLoan,
} from "../controllers/employeeLoan.controller.js";

import {
  protect,
  isAdminOrSuperAdmin,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

/* Employee self view */
router.get("/me", requirePermission("loans:view"), getMyEmployeeLoans);

/* Admin/Superadmin loan CRUD */
router.post("/", requirePermission("loans:manage"), createEmployeeLoan);
router.get("/", requirePermission("loans:manage"), listEmployeeLoans);
router.get("/employee/:employeeId", requirePermission("loans:manage"), getEmployeeLoansByEmployee);
router.get("/:id", requirePermission("loans:manage"), getEmployeeLoanById);
router.patch("/:id", requirePermission("loans:manage"), updateEmployeeLoan);
router.patch("/:id/cancel", requirePermission("loans:manage"), cancelEmployeeLoan);
router.post("/:id/manual-payment", requirePermission("loans:manage"), addManualLoanPayment);

export default router;
