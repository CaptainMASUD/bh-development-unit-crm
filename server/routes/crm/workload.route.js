// ===============================
// ✅ routes/workload.route.js (FULL UPDATED)
// Adds customer-first endpoint + keeps /employees as alias (optional)
// ===============================
import express from "express";
import { protect, isAdminOrSuperAdmin } from "../../middleware/auth.middleware.js";
import { getCustomerWorkload } from "../../controllers/workload.controller.js";

const router = express.Router();

router.use(protect);

// ✅ Primary: Customer-first workload
// GET /api/workload/customers?limit=20&cursor=...&includeTasks=false&taskStatus=all
router.get("/customers", isAdminOrSuperAdmin, getCustomerWorkload);

// ✅ Optional backward-compatible alias (if your frontend still calls /employees)
router.get("/employees", isAdminOrSuperAdmin, getCustomerWorkload);

export default router;
