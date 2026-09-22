import mongoose from "mongoose";
import AdjustmentNote from "../../models/accounting/adjustmentNote.model.js";
import {
  calculateEligibleAdjustment,
  createAdjustmentNote,
  updateAdjustmentNote,
  approveAdjustmentNote,
  postAdjustmentNote,
  cancelAdjustmentNote,
  allocateCreditNoteBalance,
} from "../../services/accounting/adjustmentNote.service.js";

const clean = (val) => String(val ?? "").trim();
const isId = (val) => mongoose.Types.ObjectId.isValid(String(val || ""));

export const listAdjustmentNotes = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.company || null;
    const filter = { ...(tenantId ? { tenantId } : {}) };

    if (req.query.noteType) {
      filter.noteType = clean(req.query.noteType).toLowerCase();
    }
    if (req.query.sourceSide) {
      filter.sourceSide = clean(req.query.sourceSide).toLowerCase();
    }
    if (req.query.status) {
      filter.status = clean(req.query.status).toLowerCase();
    }
    if (isId(req.query.originalDocumentId)) {
      filter.originalDocumentId = req.query.originalDocumentId;
    }
    if (isId(req.query.partyId)) {
      filter.partyId = req.query.partyId;
    }
    if (req.query.startDate || req.query.endDate) {
      filter.postingDate = {};
      if (req.query.startDate) filter.postingDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.postingDate.$lte = new Date(req.query.endDate);
    }
    if (req.query.q) {
      const regex = new RegExp(clean(req.query.q), "i");
      filter.$or = [
        { noteNumber: regex },
        { originalDocumentNumber: regex },
        { partyName: regex },
        { reason: regex },
      ];
    }

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const skip = (page - 1) * limit;

    const [notes, total] = await Promise.all([
      AdjustmentNote.find(filter)
        .populate("journalEntryId", "entryNo date status totalDebit totalCredit")
        .populate("reversalJournalEntryId", "entryNo date status")
        .sort({ postingDate: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdjustmentNote.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      notes,
      pageInfo: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch adjustment notes.",
    });
  }
};

export const getAdjustmentNoteById = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid adjustment note ID." });
    }

    const tenantId = req.tenantId || req.user?.company || null;
    const note = await AdjustmentNote.findOne({
      _id: req.params.id,
      ...(tenantId ? { tenantId } : {})
    })
      .populate("journalEntryId", "entryNo date status totalDebit totalCredit lines")
      .populate("reversalJournalEntryId", "entryNo date status")
      .populate("costCenter", "code name")
      .populate("department", "name")
      .populate("branch", "name")
      .lean();

    if (!note) {
      return res.status(404).json({ success: false, message: "Adjustment note not found." });
    }

    return res.json({ success: true, note });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch adjustment note.",
    });
  }
};

export const getEligibleAdjustmentInfo = async (req, res) => {
  try {
    const { documentType, documentId } = req.query;
    if (!clean(documentType) || !isId(documentId)) {
      return res.status(400).json({ success: false, message: "documentType and valid documentId are required." });
    }

    const tenantId = req.tenantId || req.user?.company || null;
    const eligibility = await calculateEligibleAdjustment({
      documentType: clean(documentType),
      documentId,
      tenantId,
    });

    return res.json({ success: true, eligibility });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to calculate eligible adjustment.",
    });
  }
};

export const createNote = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.company || null;
    const note = await createAdjustmentNote(req.body, req.user, tenantId);
    return res.status(201).json({
      success: true,
      message: "Adjustment note created.",
      note: note.note || note,
      journal: note.journal || null,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create adjustment note.",
    });
  }
};

export const updateNote = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid adjustment note ID." });
    }
    const tenantId = req.tenantId || req.user?.company || null;
    const note = await updateAdjustmentNote(req.params.id, req.body, req.user, tenantId);
    return res.json({ success: true, message: "Adjustment note updated.", note });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update adjustment note.",
    });
  }
};

export const approveNote = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid adjustment note ID." });
    }
    const tenantId = req.tenantId || req.user?.company || null;
    const note = await approveAdjustmentNote(req.params.id, req.user, tenantId);
    return res.json({ success: true, message: "Adjustment note approved.", note });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to approve adjustment note.",
    });
  }
};

export const postNote = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid adjustment note ID." });
    }
    const tenantId = req.tenantId || req.user?.company || null;
    const result = await postAdjustmentNote(req.params.id, req.body, req.user, tenantId);
    return res.json({
      success: true,
      message: "Adjustment note posted to ledger.",
      note: result.note,
      journal: result.journal,
      sourceDocument: result.sourceDocument,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to post adjustment note.",
    });
  }
};

export const cancelNote = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid adjustment note ID." });
    }
    const tenantId = req.tenantId || req.user?.company || null;
    const result = await cancelAdjustmentNote(req.params.id, req.body, req.user, tenantId);
    return res.json({
      success: true,
      message: "Adjustment note cancelled and reversed.",
      note: result.note,
      reversalJournal: result.reversalJournal,
      sourceDocument: result.sourceDocument,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to cancel adjustment note.",
    });
  }
};

export const allocateCredit = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid adjustment note ID." });
    }
    const tenantId = req.tenantId || req.user?.company || null;
    const result = await allocateCreditNoteBalance(
      {
        creditNoteId: req.params.id,
        targetDocumentType: req.body.targetDocumentType,
        targetDocumentId: req.body.targetDocumentId,
        amount: req.body.amount,
      },
      req.user,
      tenantId
    );
    return res.json({
      success: true,
      message: "Credit balance allocated successfully.",
      creditNote: result.creditNote,
      allocatedAmount: result.allocatedAmount,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to allocate credit balance.",
    });
  }
};
