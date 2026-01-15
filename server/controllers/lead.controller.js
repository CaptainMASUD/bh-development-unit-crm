// controllers/lead.controller.js
import mongoose from "mongoose"
import Lead from "../models/lead.model.js"
import Customer from "../models/customer.model.js"

/* =========================
   HELPERS
========================= */

const isAdminOrSuperAdmin = (req) =>
  req.user?.role === "admin" || req.user?.role === "superadmin"

const isMarketing = (req) => req.user?.role === "marketing_team"

/* =========================
   CREATE LEAD
   POST /leads
   ✅ marketing_team + admin/superadmin
   ✅ creates Lead + creates Customer(pending, origin=lead)
   ✅ uses TRANSACTION
========================= */
export const createLead = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // ✅ allow marketing + admin/superadmin
    if (!(isMarketing(req) || isAdminOrSuperAdmin(req))) {
      await session.abortTransaction()
      session.endSession()
      return res.status(403).json({ message: "Not authorized to create leads." })
    }

    const { contact, source, assignedTo } = req.body

    if (!contact?.name || !String(contact.name).trim()) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ message: "Contact name is required." })
    }

    const contactName = String(contact.name).trim()
    const contactEmail = contact.email ? String(contact.email).trim().toLowerCase() : undefined
    const contactPhone = contact.phone ? String(contact.phone).trim() : undefined
    const companyName = contact.companyName ? String(contact.companyName).trim() : undefined
    const leadSource = source ? String(source).trim() : undefined

    // ✅ who owns it?
    // - marketing creates -> assigned to self
    // - admin creates -> must pass assignedTo, else assigned to admin (allowed)
    const assignedUserId = assignedTo ? assignedTo : req.user._id

    // 1) Create Lead
    const [lead] = await Lead.create(
      [
        {
          contact: {
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
            companyName,
          },
          source: leadSource,
          createdBy: req.user._id,
          assignedTo: assignedUserId,
          status: "new",
          convertedAt: null,
        },
      ],
      { session }
    )

    // 2) Create pending Customer linked to this lead
    const [customer] = await Customer.create(
      [
        {
          name: contactName,
          companyName,
          email: contactEmail,
          phone: contactPhone,
          address: "",

          contactPerson: {
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
            designation: "Lead Contact",
          },

          status: "pending",
          origin: "lead",
          leadId: lead._id,

          createdBy: req.user._id,
          assignedTo: [],
        },
      ],
      { session }
    )

    // 3) Link lead -> customer
    lead.customerId = customer._id
    lead.convertedCustomer = customer._id
    lead.convertedAt = null
    await lead.save({ session })

    await session.commitTransaction()
    session.endSession()

    const populated = await Lead.findById(lead._id)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("customerId")

    return res.status(201).json({
      message: "Lead created and customer added as pending.",
      lead: populated,
      customer,
    })
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return res.status(500).json({
      message: "Server error in createLead.",
      error: err.message,
    })
  }
}

/* =========================
   GET LEADS
========================= */
export const getLeads = async (req, res) => {
  try {
    // marketing sees only assigned; admin sees all
    const filter = isMarketing(req) ? { assignedTo: req.user._id } : {}

    const leads = await Lead.find(filter)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("customerId")
      .sort({ createdAt: -1 })

    return res.status(200).json({ count: leads.length, leads })
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getLeads.",
      error: err.message,
    })
  }
}

/* =========================
   GET SINGLE LEAD
========================= */
export const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("customerId")

    if (!lead) return res.status(404).json({ message: "Lead not found." })

    // marketing can view only own
    if (isMarketing(req)) {
      const assignedId = String(lead.assignedTo?._id || lead.assignedTo || "")
      if (assignedId !== String(req.user._id)) {
        return res.status(403).json({ message: "You cannot access this lead." })
      }
    }

    return res.status(200).json({ lead })
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getLeadById.",
      error: err.message,
    })
  }
}

/* =========================
   UPDATE LEAD (FULL)
   PATCH /leads/:id
   ✅ admin can update any
   ✅ marketing can update only own
   ✅ can update: contact, status, source, assignedTo (admin)
   ✅ sync linked customer basic fields + contactPerson
========================= */
export const updateLead = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const lead = await Lead.findById(req.params.id).session(session)
    if (!lead) {
      await session.abortTransaction()
      session.endSession()
      return res.status(404).json({ message: "Lead not found." })
    }

    // marketing can only update their own
    if (isMarketing(req) && String(lead.assignedTo) !== String(req.user._id)) {
      await session.abortTransaction()
      session.endSession()
      return res.status(403).json({ message: "You cannot update this lead." })
    }

    const { contact, status, source, assignedTo } = req.body

    // ✅ contact update
    if (contact) {
      if (!contact.name || !String(contact.name).trim()) {
        await session.abortTransaction()
        session.endSession()
        return res.status(400).json({ message: "Contact name is required." })
      }

      lead.contact = {
        name: String(contact.name).trim(),
        email: contact.email ? String(contact.email).trim().toLowerCase() : undefined,
        phone: contact.phone ? String(contact.phone).trim() : undefined,
        companyName: contact.companyName ? String(contact.companyName).trim() : undefined,
      }
    }

    // ✅ source update
    if (source !== undefined) lead.source = String(source).trim()

    // ✅ status update
    if (status !== undefined) {
      const allowed = ["new", "contacted", "pending", "confirmed", "lost"]
      if (!allowed.includes(status)) {
        await session.abortTransaction()
        session.endSession()
        return res.status(400).json({ message: "Invalid lead status." })
      }
      lead.status = status
    }

    // ✅ assignedTo update (admin only)
    if (assignedTo !== undefined) {
      if (!isAdminOrSuperAdmin(req)) {
        await session.abortTransaction()
        session.endSession()
        return res.status(403).json({ message: "Only admin can reassign leads." })
      }
      lead.assignedTo = assignedTo
    }

    await lead.save({ session })

    // ✅ Sync linked customer if exists (keeps customer data aligned)
    if (lead.customerId) {
      const customer = await Customer.findById(lead.customerId).session(session)
      if (customer) {
        const c = lead.contact || {}
        customer.name = c.name || customer.name
        customer.companyName = c.companyName || customer.companyName
        customer.email = c.email || customer.email
        customer.phone = c.phone || customer.phone

        // also update contactPerson
        customer.contactPerson = {
          ...(customer.contactPerson || {}),
          name: c.name || customer.contactPerson?.name,
          email: c.email || customer.contactPerson?.email,
          phone: c.phone || customer.contactPerson?.phone,
          designation: customer.contactPerson?.designation || "Lead Contact",
        }

        await customer.save({ session })
      }
    }

    await session.commitTransaction()
    session.endSession()

    const populated = await Lead.findById(lead._id)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .populate("customerId")

    return res.status(200).json({ message: "Lead updated.", lead: populated })
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return res.status(500).json({
      message: "Server error in updateLead.",
      error: err.message,
    })
  }
}

/* =========================
   ADD NOTE TO LEAD
========================= */
export const addLeadNote = async (req, res) => {
  try {
    const { note } = req.body
    if (!note) return res.status(400).json({ message: "Note is required." })

    const lead = await Lead.findById(req.params.id)
    if (!lead) return res.status(404).json({ message: "Lead not found." })

    if (isMarketing(req) && String(lead.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ message: "You cannot add note to this lead." })
    }

    lead.notes.push({ note: String(note).trim(), createdBy: req.user._id })
    await lead.save()

    return res.status(200).json({ message: "Note added.", lead })
  } catch (err) {
    return res.status(500).json({
      message: "Server error in addLeadNote.",
      error: err.message,
    })
  }
}

/* =========================
   DELETE LEAD
   DELETE /leads/:id
   ✅ admin/superadmin only
   ✅ transaction
   ✅ optionally delete linked customer if still pending
========================= */
export const deleteLead = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    if (!isAdminOrSuperAdmin(req)) {
      await session.abortTransaction()
      session.endSession()
      return res.status(403).json({ message: "Only admin can delete leads." })
    }

    const lead = await Lead.findById(req.params.id).session(session)
    if (!lead) {
      await session.abortTransaction()
      session.endSession()
      return res.status(404).json({ message: "Lead not found." })
    }

    // If you want: ONLY delete linked customer if it's still pending
    if (lead.customerId) {
      const customer = await Customer.findById(lead.customerId).session(session)
      if (customer && String(customer.status || "").toLowerCase() === "pending") {
        await Customer.deleteOne({ _id: customer._id }).session(session)
      }
    }

    await Lead.deleteOne({ _id: lead._id }).session(session)

    await session.commitTransaction()
    session.endSession()

    return res.status(200).json({ message: "Lead deleted." })
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return res.status(500).json({
      message: "Server error in deleteLead.",
      error: err.message,
    })
  }
}

/* =========================
   ACTIVATE CUSTOMER (CONVERT)
   POST /leads/:id/convert
   admin/superadmin only
========================= */
export const convertLeadToCustomer = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    if (!isAdminOrSuperAdmin(req)) {
      await session.abortTransaction()
      session.endSession()
      return res.status(403).json({ message: "Only admin can convert/activate leads." })
    }

    const lead = await Lead.findById(req.params.id).session(session)
    if (!lead) {
      await session.abortTransaction()
      session.endSession()
      return res.status(404).json({ message: "Lead not found." })
    }

    if (lead.status !== "confirmed") {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ message: "Lead must be confirmed before activation." })
    }

    if (!lead.customerId) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ message: "No customer linked with this lead." })
    }

    const customer = await Customer.findById(lead.customerId).session(session)
    if (!customer) {
      await session.abortTransaction()
      session.endSession()
      return res.status(404).json({ message: "Linked customer not found." })
    }

    if (String(customer.status || "").toLowerCase() === "pending") {
      customer.status = "in_progress"
    }

    customer.origin = "lead"
    if (!customer.leadId) customer.leadId = lead._id

    await customer.save({ session })

    lead.convertedCustomer = customer._id
    lead.convertedAt = new Date()
    await lead.save({ session })

    await session.commitTransaction()
    session.endSession()

    return res.status(200).json({
      message: "Lead confirmed. Customer activated (in_progress).",
      customer,
    })
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return res.status(500).json({
      message: "Server error in convertLeadToCustomer.",
      error: err.message,
    })
  }
}
