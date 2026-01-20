// routes/invoice.routes.js
import express from "express";
import {
  createInvoice,
  createInvoiceFromOrder,
  getInvoices,
  getInvoiceById,
  addInvoicePayment,
  updateInvoice,
  deleteInvoice,
} from "../controllers/invoice.controller.js";

import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

// create
router.post("/", createInvoice);

// ✅ missing route fixed (this is what your error was about)
router.post("/from-order/:orderId", createInvoiceFromOrder);

// list + read
router.get("/", getInvoices);
router.get("/:id", getInvoiceById);

// payments
router.post("/:id/payments", addInvoicePayment);

// update
router.patch("/:id", updateInvoice);

// admin only delete
router.delete("/:id", isAdminOrSuperAdmin, deleteInvoice);

export default router;
