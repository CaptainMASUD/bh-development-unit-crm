// controllers/order.controller.js
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Deal from "../models/deal.model.js";
import Customer from "../models/customer.model.js";

const { Types } = mongoose;

const isAdminOrSuperAdmin = (req) =>
  req.user?.role === "admin" || req.user?.role === "superadmin";

const toObjectIdSafe = (id) => {
  try {
    if (!id) return null;
    if (Types.ObjectId.isValid(id)) return new Types.ObjectId(String(id));
    return null;
  } catch {
    return null;
  }
};

const clampInt = (n, min, max, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(v)));
};

const canAccessCustomer = (customerDoc, user) => {
  if (!customerDoc || !user) return false;
  if (user.role === "admin" || user.role === "superadmin") return true;

  const uid = String(user._id);
  const createdBy = String(customerDoc.createdBy?._id ?? customerDoc.createdBy ?? "");
  const assigned = Array.isArray(customerDoc.assignedTo) ? customerDoc.assignedTo : [];
  const assignedIds = assigned.map((x) => String(x?._id ?? x));
  return createdBy === uid || assignedIds.includes(uid);
};

const normalizeItems = (items) => {
  if (!Array.isArray(items)) return { error: "items must be an array." };
  if (items.length > 500) return { error: "Too many items (max 500)." };

  const out = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;

    const name = String(it.name ?? "").trim();
    const qty = Number(it.qty ?? 0);
    const unitPrice = Number(it.unitPrice ?? 0);
    const discount = Number(it.discount ?? 0);

    if (!name) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
    if (!Number.isFinite(discount) || discount < 0) continue;

    out.push({
      productId:
        it.productId && Types.ObjectId.isValid(it.productId)
          ? new Types.ObjectId(String(it.productId))
          : null,
      name,
      qty,
      unitPrice,
      discount,
      note: it.note ? String(it.note).trim() : "",
    });
  }

  return { items: out };
};

const calcTotals = (items) => {
  const subTotal = (items || []).reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const discountTotal = (items || []).reduce((s, it) => s + (it.discount || 0), 0);
  const total = Math.max(0, subTotal - discountTotal);
  return { subTotal, discountTotal, total };
};

const ORDER_STATUSES = ["draft", "confirmed", "processing", "shipped", "delivered", "cancelled"];

/* =========================================================
   CREATE ORDER (direct)
   POST /orders
   body: { customerId, dealId?, items?, status? }
========================================================= */
export const createOrder = async (req, res) => {
  try {
    const customerId = toObjectIdSafe(req.body.customerId);
    if (!customerId) return res.status(400).json({ message: "customerId is required." });

    const customer = await Customer.findById(customerId).select("_id createdBy assignedTo").lean();
    if (!customer) return res.status(404).json({ message: "Customer not found." });
    if (!canAccessCustomer(customer, req.user)) return res.status(403).json({ message: "No access." });

    const dealId = toObjectIdSafe(req.body.dealId);

    let items = [];
    if (dealId) {
      const deal = await Deal.findById(dealId).select("customerId items").lean();
      if (!deal) return res.status(404).json({ message: "Deal not found." });
      if (String(deal.customerId) !== String(customerId)) {
        return res.status(400).json({ message: "dealId does not belong to customerId." });
      }
      items = Array.isArray(deal.items) ? deal.items : [];
    }

    if (req.body.items !== undefined) {
      const norm = normalizeItems(req.body.items);
      if (norm.error) return res.status(400).json({ message: norm.error });
      items = norm.items;
    }

    if (!items.length) return res.status(400).json({ message: "Order must have at least 1 item." });

    const status = String(req.body.status ?? "draft").toLowerCase();
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid order status." });

    const totals = calcTotals(items);

    const order = await Order.create({
      customerId,
      dealId: dealId ?? null,
      items,
      totals,
      status,
      createdBy: req.user._id,
    });

    return res.status(201).json({ message: "Order created.", order });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createOrder.", error: err.message });
  }
};

/* =========================================================
   ✅ MISSING: CREATE ORDER FROM DEAL
   POST /orders/from-deal/:dealId
   - copies customerId + items from deal
========================================================= */
export const createOrderFromDeal = async (req, res) => {
  try {
    const dealId = toObjectIdSafe(req.params.dealId);
    if (!dealId) return res.status(400).json({ message: "Invalid dealId." });

    const deal = await Deal.findById(dealId).select("_id customerId items").lean();
    if (!deal) return res.status(404).json({ message: "Deal not found." });

    const customer = await Customer.findById(deal.customerId).select("_id createdBy assignedTo").lean();
    if (!customer) return res.status(404).json({ message: "Customer not found for deal." });
    if (!canAccessCustomer(customer, req.user)) return res.status(403).json({ message: "No access." });

    const items = Array.isArray(deal.items) ? deal.items : [];
    if (!items.length) return res.status(400).json({ message: "Deal has no items to create an order." });

    const totals = calcTotals(items);

    const order = await Order.create({
      customerId: deal.customerId,
      dealId: deal._id,
      items,
      totals,
      status: "draft",
      createdBy: req.user._id,
    });

    return res.status(201).json({ message: "Order created from deal.", order });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createOrderFromDeal.", error: err.message });
  }
};

/* =========================================================
   ✅ MISSING: GET ORDERS (alias of your listOrders)
   GET /orders?customerId=&status=&limit=&cursor=
========================================================= */
export const getOrders = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdSafe(req.query.cursor);

    const filter = {};
    const customerId = toObjectIdSafe(req.query.customerId);
    if (customerId) filter.customerId = customerId;

    const status = req.query.status ? String(req.query.status).toLowerCase() : null;
    if (status) filter.status = status;

    if (cursor) filter._id = { $lt: cursor };

    let rows = await Order.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("customerId", "name companyName createdBy assignedTo")
      .lean();

    if (!isAdminOrSuperAdmin(req)) {
      rows = rows.filter((o) => canAccessCustomer(o.customerId, req.user));
    }

    const hasMore = rows.length > limit;
    const orders = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(orders[orders.length - 1]._id) : null;

    return res.status(200).json({ count: orders.length, hasMore, nextCursor, orders });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getOrders.", error: err.message });
  }
};

/* =========================================================
   GET SINGLE ORDER
   GET /orders/:id
========================================================= */
export const getOrderById = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid order id." });

    const order = await Order.findById(id)
      .populate("customerId", "_id createdBy assignedTo name companyName")
      .lean();
    if (!order) return res.status(404).json({ message: "Order not found." });

    if (!canAccessCustomer(order.customerId, req.user)) return res.status(403).json({ message: "No access." });

    return res.status(200).json({ order });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getOrderById.", error: err.message });
  }
};

/* =========================================================
   ✅ MISSING: UPDATE ORDER (general patch)
   PATCH /orders/:id
   body: { items?, status?, dealId? }
========================================================= */
export const updateOrder = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid order id." });

    const existing = await Order.findById(id).populate("customerId", "_id createdBy assignedTo").lean();
    if (!existing) return res.status(404).json({ message: "Order not found." });
    if (!canAccessCustomer(existing.customerId, req.user)) return res.status(403).json({ message: "No access." });

    const $set = {};

    if (req.body.status !== undefined) {
      const status = String(req.body.status ?? "").toLowerCase();
      if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid order status." });
      $set.status = status;
    }

    if (req.body.items !== undefined) {
      const norm = normalizeItems(req.body.items);
      if (norm.error) return res.status(400).json({ message: norm.error });
      if (!norm.items.length) return res.status(400).json({ message: "Order must have at least 1 item." });

      $set.items = norm.items;
      $set.totals = calcTotals(norm.items);
    }

    if (req.body.dealId !== undefined) {
      const dealId = req.body.dealId ? toObjectIdSafe(req.body.dealId) : null;
      if (req.body.dealId && !dealId) return res.status(400).json({ message: "Invalid dealId." });

      if (dealId) {
        const deal = await Deal.findById(dealId).select("_id customerId").lean();
        if (!deal) return res.status(404).json({ message: "Deal not found." });
        if (String(deal.customerId) !== String(existing.customerId._id ?? existing.customerId)) {
          return res.status(400).json({ message: "dealId does not belong to this order customer." });
        }
      }

      $set.dealId = dealId;
    }

    if (Object.keys($set).length === 0) return res.status(200).json({ message: "No changes." });

    await Order.updateOne({ _id: id }, { $set });
    const updated = await Order.findById(id).lean();

    return res.status(200).json({ message: "Order updated.", order: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateOrder.", error: err.message });
  }
};

/* =========================================================
   UPDATE ORDER STATUS (keep your existing)
   PATCH /orders/:id/status
========================================================= */
export const updateOrderStatus = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid order id." });

    const order = await Order.findById(id).populate("customerId", "_id createdBy assignedTo").lean();
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (!canAccessCustomer(order.customerId, req.user)) return res.status(403).json({ message: "No access." });

    const status = String(req.body.status ?? "").toLowerCase();
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid order status." });

    await Order.updateOne({ _id: id }, { $set: { status } });
    const updated = await Order.findById(id).lean();

    return res.status(200).json({ message: "Order status updated.", order: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateOrderStatus.", error: err.message });
  }
};

/* =========================================================
   ✅ MISSING: UPSERT ORDER ITEMS
   PATCH /orders/:id/items
   body: { items: [...] }
========================================================= */
export const upsertOrderItems = async (req, res) => {
  try {
    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid order id." });

    const order = await Order.findById(id).populate("customerId", "_id createdBy assignedTo").lean();
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (!canAccessCustomer(order.customerId, req.user)) return res.status(403).json({ message: "No access." });

    const norm = normalizeItems(req.body.items);
    if (norm.error) return res.status(400).json({ message: norm.error });
    if (!norm.items.length) return res.status(400).json({ message: "Order must have at least 1 item." });

    const totals = calcTotals(norm.items);

    await Order.updateOne({ _id: id }, { $set: { items: norm.items, totals } });
    const updated = await Order.findById(id).lean();

    return res.status(200).json({ message: "Order items updated.", order: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error in upsertOrderItems.", error: err.message });
  }
};

/* =========================================================
   ✅ MISSING: DELETE ORDER
   DELETE /orders/:id (admin only)
========================================================= */
export const deleteOrder = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Only admin can delete orders." });
    }

    const id = toObjectIdSafe(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid order id." });

    const r = await Order.deleteOne({ _id: id });
    if (r.deletedCount === 0) return res.status(404).json({ message: "Order not found." });

    return res.status(200).json({ message: "Order deleted." });
  } catch (err) {
    return res.status(500).json({ message: "Server error in deleteOrder.", error: err.message });
  }
};
