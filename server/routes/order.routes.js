// routes/order.routes.js
import express from "express";
import {
  createOrder,
  createOrderFromDeal,
  getOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  upsertOrderItems,
  deleteOrder,
} from "../controllers/order.controller.js";

import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

// create order directly
router.post("/", createOrder);

// create order from deal
router.post("/from-deal/:dealId", createOrderFromDeal);

// list + read
router.get("/", getOrders);
router.get("/:id", getOrderById);

// updates
router.patch("/:id", updateOrder);
router.patch("/:id/status", updateOrderStatus);
router.patch("/:id/items", upsertOrderItems);

// admin only delete
router.delete("/:id", isAdminOrSuperAdmin, deleteOrder);

export default router;
