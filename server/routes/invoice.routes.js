import express from "express";
import {
  createInvoiceFromDeal,
  addInvoicePayment,
  getInvoiceById,
  listInvoices,
} from "../controllers/invoice.controller.js";
import {
  protect,
  isAdminOrSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, isAdminOrSuperAdmin);

router.get("/", listInvoices);
router.post("/from-deal/:dealId", createInvoiceFromDeal);
router.post("/:id/payments", addInvoicePayment);
router.get("/:id", getInvoiceById);

export default router;
