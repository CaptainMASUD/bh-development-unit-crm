import express from "express";
import {
  createInvoiceFromDeal,
  getInvoiceById,
  listInvoices,
} from "../../controllers/invoice.controller.js";
import { recordCustomerPayment } from "../../controllers/accounting.controller.js";
import {
  protect,
  requireAnyPermission,
  requirePermission,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/", requireAnyPermission(["finance:view", "deals:view"]), listInvoices);
router.post("/from-deal/:dealId", requireAnyPermission(["finance:manage", "deals:manage"]), createInvoiceFromDeal);
router.post("/:id/payments", requirePermission("finance:manage"), recordCustomerPayment);
router.get("/:id", requireAnyPermission(["finance:view", "deals:view"]), getInvoiceById);

export default router;
