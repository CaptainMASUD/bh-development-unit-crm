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
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

/* Employee self view */
router.get("/me", getMyEmployeeLoans);

/* Admin/Superadmin loan CRUD */
router.post("/", isAdminOrSuperAdmin, createEmployeeLoan);
router.get("/", isAdminOrSuperAdmin, listEmployeeLoans);
router.get("/employee/:employeeId", isAdminOrSuperAdmin, getEmployeeLoansByEmployee);
router.get("/:id", isAdminOrSuperAdmin, getEmployeeLoanById);
router.patch("/:id", isAdminOrSuperAdmin, updateEmployeeLoan);
router.patch("/:id/cancel", isAdminOrSuperAdmin, cancelEmployeeLoan);
router.post("/:id/manual-payment", isAdminOrSuperAdmin, addManualLoanPayment);

export default router;
