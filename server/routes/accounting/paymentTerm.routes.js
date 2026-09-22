import express from "express";
import {
  listPaymentTerms,
  getPaymentTermById,
  createPaymentTerm,
  updatePaymentTerm,
  togglePaymentTermActive,
  previewSchedule,
} from "../../controllers/accounting/paymentTerm.controller.js";
import { requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", requirePermission("finance:payment-term:view"), listPaymentTerms);
router.post("/preview", requirePermission("finance:payment-term:view"), previewSchedule);
router.get("/:id", requirePermission("finance:payment-term:view"), getPaymentTermById);
router.post("/", requirePermission("finance:payment-term:manage"), createPaymentTerm);
router.put("/:id", requirePermission("finance:payment-term:manage"), updatePaymentTerm);
router.patch("/:id/toggle-active", requirePermission("finance:payment-term:manage"), togglePaymentTermActive);

export default router;
