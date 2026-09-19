import express from "express";
import {
  listSalaryGrades,
  getSalaryGradeById,
  createSalaryGrade,
  updateSalaryGrade,
  deleteSalaryGrade,
} from "../../controllers/payroll/salaryGrade.controller.js";
import { protect, requirePermission, requireAnyPermission } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/", requireAnyPermission(["payroll:view", "payroll:manage"]), listSalaryGrades);
router.get("/:id", requireAnyPermission(["payroll:view", "payroll:manage"]), getSalaryGradeById);
router.post("/", requirePermission("payroll:manage"), createSalaryGrade);
router.put("/:id", requirePermission("payroll:manage"), updateSalaryGrade);
router.delete("/:id", requirePermission("payroll:manage"), deleteSalaryGrade);

export default router;
