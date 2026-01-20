import mongoose from "mongoose";
import Lead from "../models/lead.model.js";
import Customer from "../models/customer.model.js";
import Activity from "../models/activity.model.js";
import Deal from "../models/deal.model.js";

const isAdminOrSuperAdmin = (req) =>
  req.user?.role === "admin" || req.user?.role === "superadmin";

const isMarketing = (req) => req.user?.role === "marketing_team";

const toObjectIdSafe = (id) => {
  try {
    if (!id) return null;
    if (mongoose.isValidObjectId(id)) return new mongoose.Types.ObjectId(String(id));
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

const idOf = (val) => {
  if (!val) return null;
  if (typeof val === "object" && val._id) return val._id;
  return val;
};

const canAccessLead = (req, lead) => {
  if (isAdminOrSuperAdmin(req)) return true;
  if (isMarketing(req)) {
    const assignedToId = idOf(lead.assignedTo);
    return String(assignedToId) === String(req.user._id);
  }
  return false;
};

const normalizeContact = (contact) => {
  const contactName = contact?.name ? String(contact.name).trim() : "";
  const companyName = contact?.companyName ? String(contact.companyName).trim() : "";
  const email = contact?.email ? String(contact.email).trim().toLowerCase() : "";
  const phone = contact?.phone ? String(contact.phone).trim() : "";
  return { contactName, companyName, email, phone };
};

const allowedLeadStatus = new Set(["new", "contacted", "pending", "confirmed", "lost"]);

export const createLead = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!(isMarketing(req) || isAdminOrSuperAdmin(req))) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Not authorized to create leads." });
    }

    const { contact, source, assignedTo } = req.body;
    const { contactName, companyName, email, phone } = normalizeContact(contact);

    if (!contactName) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Contact person name is required." });
    }
    if (!companyName) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Customer/Company name is required." });
    }

    const leadSource = source ? String(source).trim() : "";
    const assignedUserId = toObjectIdSafe(assignedTo) || req.user._id;

    const [lead] = await Lead.create(
      [
        {
          contact: { name: contactName, email, phone, companyName },
          source: leadSource,
          createdBy: req.user._id,
          assignedTo: assignedUserId,
          status: "new",
          convertedAt: null,
          lastContactedAt: null,
          nextFollowUpAt: null,
        },
      ],
      { session }
    );

    const [customer] = await Customer.create(
      [
        {
          name: companyName,
          companyName,
          email,
          phone,
          address: "",
          contactPerson: { name: contactName, email, phone, designation: "Lead Contact" },
          status: "pending",
          origin: "lead",
          leadId: lead._id,
          createdBy: req.user._id,
          assignedTo: [],
        },
      ],
      { session }
    );

    await Lead.updateOne(
      { _id: lead._id },
      { $set: { customerId: customer._id, convertedCustomer: customer._id, convertedAt: null } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const populated = await Lead.findById(lead._id)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("customerId")
      .lean();

    return res.status(201).json({
      message: "Lead created and customer added as pending.",
      lead: populated,
      customer,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Server error in createLead.", error: err.message });
  }
};

export const getLeads = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req) && !isMarketing(req)) {
      return res.status(403).json({ message: "Not allowed for this role." });
    }

    const limit = clampInt(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdSafe(req.query.cursor);
    const status = req.query.status ? String(req.query.status).toLowerCase() : "";
    const source = req.query.source ? String(req.query.source).trim() : "";
    const search = req.query.search ? String(req.query.search).trim() : "";
    const includeCount = String(req.query.includeCount || "") === "1";

    const filter = {};

    if (isMarketing(req)) filter.assignedTo = req.user._id;
    if (cursor) filter._id = { $lt: cursor };
    if (status && allowedLeadStatus.has(status)) filter.status = status;
    if (source) filter.source = source;
    if (search) filter.$text = { $search: search };

    const projection = "leadNumber contact status source nextFollowUpAt lastContactedAt createdAt";

    const rows = await Lead.find(filter)
      .select(projection)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = items.length ? String(items[items.length - 1]._id) : null;

    let totalCount = null;
    if (includeCount) {
      const countFilter = { ...filter };
      delete countFilter._id;
      totalCount = await Lead.countDocuments(countFilter);
    }

    return res.status(200).json({
      items,
      leads: items,
      count: includeCount ? totalCount : items.length,
      hasMore,
      nextCursor,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getLeads.", error: err.message });
  }
};

export const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("customerId")
      .lean();

    if (!lead) return res.status(404).json({ message: "Lead not found." });

    if (!canAccessLead(req, lead)) {
      return res.status(403).json({ message: "You cannot access this lead." });
    }

    return res.status(200).json({ lead });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getLeadById.", error: err.message });
  }
};

export const updateLead = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const lead = await Lead.findById(req.params.id).session(session);
    if (!lead) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Lead not found." });
    }

    if (!canAccessLead(req, lead)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "You cannot update this lead." });
    }

    const { contact, status, source, assignedTo } = req.body;
    let contactChanged = false;

    if (contact) {
      const { contactName, companyName, email, phone } = normalizeContact(contact);

      if (!contactName) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Contact person name is required." });
      }
      if (!companyName) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Customer/Company name is required." });
      }

      lead.contact = { name: contactName, email, phone, companyName };
      contactChanged = true;
    }

    if (source !== undefined) lead.source = String(source || "").trim();

    if (status !== undefined) {
      const st = String(status).toLowerCase();
      if (!allowedLeadStatus.has(st)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Invalid lead status." });
      }
      lead.status = st;
    }

    if (assignedTo !== undefined) {
      if (!isAdminOrSuperAdmin(req)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({ message: "Only admin can reassign leads." });
      }
      const aid = toObjectIdSafe(assignedTo);
      if (!aid) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Invalid assignedTo." });
      }
      lead.assignedTo = aid;
    }

    await lead.save({ session });

    if (lead.customerId && contactChanged) {
      const customer = await Customer.findById(lead.customerId).session(session);
      if (customer) {
        const c = lead.contact || {};

        if (c.companyName) {
          customer.name = c.companyName;
          customer.companyName = c.companyName;
        }
        customer.email = c.email || customer.email;
        customer.phone = c.phone || customer.phone;

        customer.contactPerson = {
          ...(customer.contactPerson || {}),
          name: c.name || customer.contactPerson?.name,
          email: c.email || customer.contactPerson?.email,
          phone: c.phone || customer.contactPerson?.phone,
          designation: customer.contactPerson?.designation || "Lead Contact",
        };

        await customer.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    const populated = await Lead.findById(lead._id)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("customerId")
      .lean();

    return res.status(200).json({ message: "Lead updated.", lead: populated });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Server error in updateLead.", error: err.message });
  }
};

export const addLeadNote = async (req, res) => {
  try {
    const note = String(req.body.note || "").trim();
    if (!note) return res.status(400).json({ message: "Note is required." });

    const lead = await Lead.findById(req.params.id).select("_id assignedTo").lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    if (isMarketing(req) && String(lead.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ message: "You cannot add note to this lead." });
    }
    if (!isAdminOrSuperAdmin(req) && !isMarketing(req)) {
      return res.status(403).json({ message: "Not allowed for this role." });
    }

    await Lead.updateOne(
      { _id: lead._id },
      { $push: { notes: { note, createdBy: req.user._id, createdAt: new Date() } } }
    );

    return res.status(200).json({ message: "Note added." });
  } catch (err) {
    return res.status(500).json({ message: "Server error in addLeadNote.", error: err.message });
  }
};

export const deleteLead = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!isAdminOrSuperAdmin(req)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Only admin can delete leads." });
    }

    const lead = await Lead.findById(req.params.id).session(session);
    if (!lead) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Lead not found." });
    }

    if (lead.customerId) {
      const customer = await Customer.findById(lead.customerId).session(session);
      if (customer && String(customer.status || "").toLowerCase() === "pending") {
        await Customer.deleteOne({ _id: customer._id }).session(session);
      }
    }

    await Lead.deleteOne({ _id: lead._id }).session(session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ message: "Lead deleted." });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Server error in deleteLead.", error: err.message });
  }
};

export const convertLeadToCustomer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!isAdminOrSuperAdmin(req)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Only admin can convert/activate leads." });
    }

    const lead = await Lead.findById(req.params.id).session(session);
    if (!lead) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Lead not found." });
    }

    if (lead.status !== "confirmed") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Lead must be confirmed before activation." });
    }

    if (!lead.customerId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "No customer linked with this lead." });
    }

    const customer = await Customer.findById(lead.customerId).session(session);
    if (!customer) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Linked customer not found." });
    }

    if (String(customer.status || "").toLowerCase() === "pending") customer.status = "in_progress";
    customer.origin = "lead";
    if (!customer.leadId) customer.leadId = lead._id;

    await customer.save({ session });

    lead.convertedCustomer = customer._id;
    lead.convertedAt = new Date();
    await lead.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Lead confirmed. Customer activated (in_progress).",
      customer,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Server error in convertLeadToCustomer.", error: err.message });
  }
};

export const updateLeadFollowup = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).select("_id assignedTo").lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    if (isMarketing(req) && String(lead.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ message: "You cannot update this lead." });
    }
    if (!isAdminOrSuperAdmin(req) && !isMarketing(req)) {
      return res.status(403).json({ message: "Not allowed for this role." });
    }

    const update = {};

    if (req.body.lastContactedAt !== undefined) {
      const d = req.body.lastContactedAt ? new Date(req.body.lastContactedAt) : null;
      if (d && Number.isNaN(d.getTime())) return res.status(400).json({ message: "Invalid lastContactedAt." });
      update.lastContactedAt = d;
    }

    if (req.body.nextFollowUpAt !== undefined) {
      const d = req.body.nextFollowUpAt ? new Date(req.body.nextFollowUpAt) : null;
      if (d && Number.isNaN(d.getTime())) return res.status(400).json({ message: "Invalid nextFollowUpAt." });
      update.nextFollowUpAt = d;
    }

    await Lead.updateOne({ _id: lead._id }, { $set: update });

    const fresh = await Lead.findById(lead._id).select("lastContactedAt nextFollowUpAt").lean();

    return res.status(200).json({ message: "Lead follow-up updated.", lead: fresh });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateLeadFollowup.", error: err.message });
  }
};

export const getLeadTimeline = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).select("_id assignedTo").lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    if (isMarketing(req) && String(lead.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ message: "You cannot access this lead." });
    }

    if (!isAdminOrSuperAdmin(req) && !isMarketing(req)) {
      return res.status(403).json({ message: "Not allowed for this role." });
    }

    const limit = clampInt(req.query.limit, 1, 100, 20);
    const cursor = toObjectIdSafe(req.query.cursor);

    const filter = { leadId: lead._id };
    if (cursor) filter._id = { $lt: cursor };

    const rows = await Activity.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("createdBy", "name email role")
      .lean();

    const hasMore = rows.length > limit;
    const activities = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = activities.length ? String(activities[activities.length - 1]._id) : null;

    return res.status(200).json({
      count: activities.length,
      hasMore,
      nextCursor,
      activities,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getLeadTimeline.", error: err.message });
  }
};

export const createDealFromLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).select("_id assignedTo customerId").lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    if (!isAdminOrSuperAdmin(req) && isMarketing(req)) {
      if (String(lead.assignedTo) !== String(req.user._id)) {
        return res.status(403).json({ message: "No access to this lead." });
      }
    } else if (!isAdminOrSuperAdmin(req) && !isMarketing(req)) {
      return res.status(403).json({ message: "Not allowed for this role." });
    }

    if (!lead.customerId) return res.status(400).json({ message: "Lead has no linked customerId." });

    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "title is required." });

    const expectedCloseAt = req.body.expectedCloseAt ? new Date(req.body.expectedCloseAt) : null;
    if (expectedCloseAt && Number.isNaN(expectedCloseAt.getTime())) {
      return res.status(400).json({ message: "Invalid expectedCloseAt." });
    }

    const valueNum = Number(req.body.value);
    const value = Number.isFinite(valueNum) && valueNum >= 0 ? valueNum : 0;

    const currency = String(req.body.currency || "BDT").trim();
    const note = String(req.body.note || "").trim();

    const deal = await Deal.create({
      title,
      customerId: lead.customerId,
      leadId: lead._id,
      stage: "new",
      value,
      currency,
      expectedCloseAt,
      createdBy: req.user._id,
      assignedTo: isMarketing(req) ? [req.user._id] : [lead.assignedTo],
      notes: note ? [{ text: note, createdBy: req.user._id }] : [],
    });

    return res.status(201).json({ message: "Deal created from lead.", deal });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createDealFromLead.", error: err.message });
  }
};
