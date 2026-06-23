import mongoose from "mongoose";
import Lead from "../models/lead.model.js";
import LeadMessage from "../models/leadMessage.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";

const toObjectId = (value) => {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;
};

const normalizeString = (value = "") => String(value || "").trim();

const isAdminOrSuperAdmin = (req) =>
  ["admin", "superadmin"].includes(req?.user?.role);

const buildLeadAccessMatch = (req) => {
  if (isAdminOrSuperAdmin(req)) return {};

  const me = new mongoose.Types.ObjectId(req.user._id);
  return {
    $or: [
      { assignedTo: me },
      { allowedUsers: me },
      { createdBy: me, ownerLocked: false },
    ],
  };
};

const assertLeadAccessOrThrow = async ({ req, leadId }) => {
  const exists = await Lead.exists({
    _id: leadId,
    ...buildLeadAccessMatch(req),
  });

  if (!exists) {
    const err = new Error("Not authorized to access this lead inbox");
    err.statusCode = 403;
    throw err;
  }
};

export const listLeadMessages = async (req, res) => {
  try {
    const leadId = toObjectId(req.params.leadId || req.query.leadId);
    if (!leadId) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId });

    const recipientId = toObjectId(req.query.recipientId);
    if (!recipientId) return res.status(400).json({ message: "recipientId is required" });

    const me = new mongoose.Types.ObjectId(req.user._id);
    const limit = Math.min(Math.max(Number(req.query.limit || 80), 1), 150);

    const messages = await LeadMessage.find({
      leadId,
      $or: [
        { senderId: me, recipientId },
        { senderId: recipientId, recipientId: me },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("senderId", "name email role avatar")
      .populate("recipientId", "name email role avatar")
      .lean();

    res.json({
      messages: messages.reverse(),
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Failed to list lead messages",
      error: err.message,
    });
  }
};

export const sendLeadMessage = async (req, res) => {
  try {
    const leadId = toObjectId(req.params.leadId || req.body?.leadId);
    if (!leadId) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId });

    const recipientId = toObjectId(req.body?.recipientId);
    if (!recipientId) return res.status(400).json({ message: "recipientId is required" });
    if (String(recipientId) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot send a message to yourself" });
    }

    const message = normalizeString(req.body?.message);
    if (!message) return res.status(400).json({ message: "Message is required" });
    if (message.length > 2000) {
      return res.status(400).json({ message: "Message must be 2000 characters or less" });
    }

    const doc = await LeadMessage.create({
      leadId,
      message,
      senderId: req.user._id,
      recipientId,
      senderRole: req.user.role,
      readBy: [{ userId: req.user._id, readAt: new Date() }],
    });

    const populated = await LeadMessage.findById(doc._id)
      .populate("senderId", "name email role avatar")
      .populate("recipientId", "name email role avatar")
      .lean();

    const lead = await Lead.findById(leadId).select("leadNumber contact").lean();
    await Notification.create({
      userId: recipientId,
      title: "New inbox message",
      message: `${req.user.name || "Someone"}: ${message.slice(0, 140)}`,
      type: "lead",
      priority: "normal",
      entityType: "Lead",
      entityId: leadId,
      actionUrl: lead?.leadNumber ? `lead:${lead.leadNumber}` : "",
      createdBy: req.user._id,
    }).catch(() => null);

    res.status(201).json({
      message: "Message sent",
      data: populated,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Failed to send lead message",
      error: err.message,
    });
  }
};

export const markLeadMessagesRead = async (req, res) => {
  try {
    const leadId = toObjectId(req.params.leadId || req.body?.leadId);
    if (!leadId) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId });

    const otherUserId = toObjectId(req.body?.recipientId || req.query.recipientId);
    const filter = {
      leadId,
      recipientId: req.user._id,
      "readBy.userId": { $ne: req.user._id },
    };
    if (otherUserId) filter.senderId = otherUserId;

    await LeadMessage.updateMany(
      filter,
      {
        $push: { readBy: { userId: req.user._id, readAt: new Date() } },
      }
    );

    res.json({ message: "Messages marked as read" });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Failed to mark messages read",
      error: err.message,
    });
  }
};

export const getLeadMessageParticipants = async (req, res) => {
  try {
    const leadId = toObjectId(req.params.leadId);
    if (!leadId) return res.status(400).json({ message: "Invalid lead id" });

    await assertLeadAccessOrThrow({ req, leadId });

    const lead = await Lead.findById(leadId)
      .populate("assignedTo", "name email role avatarUrl workStatus")
      .populate("allowedUsers", "name email role avatarUrl workStatus")
      .lean();

    if (!lead) return res.status(404).json({ message: "Lead not found" });

    let users = [];
    if (isAdminOrSuperAdmin(req)) {
      const map = new Map();
      const maybeUsers = [lead.assignedTo, ...(Array.isArray(lead.allowedUsers) ? lead.allowedUsers : [])];
      for (const user of maybeUsers) {
        if (user?.role === "marketing_team") map.set(String(user._id), user);
      }
      users = Array.from(map.values());
    } else {
      users = await User.find({
        role: { $in: ["admin", "superadmin"] },
        isActive: true,
      })
        .select("name email role avatarUrl workStatus")
        .sort({ role: 1, name: 1 })
        .limit(50)
        .lean();
    }

    const ids = users.map((user) => user._id);
    const unread = await LeadMessage.aggregate([
      {
        $match: {
          leadId,
          recipientId: new mongoose.Types.ObjectId(req.user._id),
          senderId: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
          "readBy.userId": { $ne: new mongoose.Types.ObjectId(req.user._id) },
        },
      },
      { $group: { _id: "$senderId", count: { $sum: 1 } } },
    ]);

    const unreadMap = new Map(unread.map((item) => [String(item._id), item.count]));

    res.json({
      lead: {
        _id: lead._id,
        leadNumber: lead.leadNumber,
        contact: lead.contact,
      },
      participants: users.map((user) => ({
        ...user,
        unreadCount: unreadMap.get(String(user._id)) || 0,
      })),
      unreadCount: unread.reduce((sum, item) => sum + Number(item.count || 0), 0),
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Failed to list inbox participants",
      error: err.message,
    });
  }
};

export const getLeadMessageUnreadCount = async (req, res) => {
  try {
    const filter = {
      recipientId: req.user._id,
      "readBy.userId": { $ne: req.user._id },
    };

    const leadId = toObjectId(req.query.leadId);
    if (leadId) filter.leadId = leadId;

    const unreadCount = await LeadMessage.countDocuments(filter);
    res.json({ unreadCount });
  } catch (err) {
    res.status(500).json({
      message: "Failed to get inbox unread count",
      error: err.message,
    });
  }
};
