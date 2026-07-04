import express from "express";
import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
  deleteExpenseCategory,
  listExpenseCategories,
  listExpenses,
  updateExpense,
  updateExpenseCategory,
} from "../controllers/expense.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

const requireAnyPermission = (permissions) => (req, res, next) => {
  if (["admin", "superadmin"].includes(req.user?.role)) return next();
  const groupPermissions = req.user?.permissionGroup?.isActive === false ? [] : req.user?.permissionGroup?.permissions || [];
  const allowed = permissions.some((permission) => {
    const manageEquivalent = String(permission).endsWith(":view")
      ? String(permission).replace(/:view$/, ":manage")
      : "";
    return groupPermissions.includes(permission) || (manageEquivalent && groupPermissions.includes(manageEquivalent));
  });
  if (!allowed) return res.status(403).json({ message: "Permission denied." });
  return next();
};

router.get("/categories", requireAnyPermission(["expense-setup:view", "expenses:view"]), listExpenseCategories);
router.post("/categories", requirePermission("expense-setup:manage"), createExpenseCategory);
router.patch("/categories/:id", requirePermission("expense-setup:manage"), updateExpenseCategory);
router.delete("/categories/:id", requirePermission("expense-setup:manage"), deleteExpenseCategory);

router.get("/", requirePermission("expenses:view"), listExpenses);
router.post("/", requirePermission("expenses:manage"), createExpense);
router.patch("/:id", requirePermission("expenses:manage"), updateExpense);
router.delete("/:id", requirePermission("expenses:manage"), deleteExpense);

export default router;
