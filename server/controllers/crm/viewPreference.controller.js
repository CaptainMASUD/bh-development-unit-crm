// controllers/viewPreference.controller.js
import crypto from "crypto";
import ViewPreference from "../../models/viewPreference.model.js";

const hashETag = (obj) => {
  const str = JSON.stringify(obj || {});
  return crypto.createHash("sha1").update(str).digest("hex");
};

// ✅ Allowed columns for each view-key (future proof)
const VIEW_ALLOWED_COLUMNS = {
  "leads.list": [
    "leadNumber",
    "contact.name",
    "contact.companyName",
    "contact.phone",
    "contact.email",
    "status",
    "pipelineStage",
    "priority",
    "purchaseType",
    "source",
    "tags",
    "nextFollowUpAt",
    "lastContactedAt",
    "createdAt",
    "updatedAt",
  ],
  "deals.accounting": [
    "title",
    "dealNo",
    "customer",
    "leadNumber",
    "stage",
    "budgetMin",
    "budgetMax",
    "expectedValue",
    "dealValue",
    "invoiceTotal",
    "paidAmount",
    "dueAmount",
    "invoiceStatus",
    "invoiceNo",
    "closeDate",
  ],
  "employee-loans.list": [
    "employee",
    "employeeId",
    "department",
    "position",
    "loanNo",
    "status",
    "loanAmount",
    "paidAmount",
    "remainingAmount",
    "installmentAmount",
    "startPeriod",
    "issueDate",
    "reason",
    "repaymentsCount",
    "progress",
    "createdAt",
    "updatedAt",
  ],
};

// ✅ Default selected columns per view-key
// By default show: Lead, Status, Stage, Priority, Follow-up
const VIEW_DEFAULT_COLUMNS = {
  "leads.list": ["leadNumber", "status", "pipelineStage", "priority", "nextFollowUpAt"],
  "deals.accounting": [
    "title",
    "dealNo",
    "customer",
    "stage",
    "dealValue",
    "invoiceTotal",
    "paidAmount",
    "dueAmount",
    "invoiceStatus",
  ],
  "employee-loans.list": [
    "employee",
    "loanNo",
    "status",
    "loanAmount",
    "paidAmount",
    "remainingAmount",
    "installmentAmount",
    "startPeriod",
    "progress",
    "createdAt",
  ],
};

const normalizeColumns = (cols, allowed) => {
  const set = new Set(allowed);
  const out = [];
  for (const c of cols || []) {
    const v = String(c || "").trim();
    if (!v) continue;
    if (!set.has(v)) continue;
    out.push(v);
  }
  // de-dupe while keeping order
  return [...new Set(out)];
};

export const getViewPreference = async (req, res) => {
  try {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ message: "Invalid preference key" });

    const allowed = VIEW_ALLOWED_COLUMNS[key];
    if (!allowed) return res.status(404).json({ message: "Unknown view key" });

    const defaults = VIEW_DEFAULT_COLUMNS[key] || allowed;

    const doc = await ViewPreference.findOne({ userId: req.user._id, key }).lean();

    const payload = {
      key,
      allowedColumns: allowed,
      columns: Array.isArray(doc?.columns) && doc.columns.length ? doc.columns : defaults,
      updatedAt: doc?.updatedAt || null,
    };

    const etag = hashETag(payload);
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.setHeader("ETag", etag);
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: "Failed to get preference", error: err.message });
  }
};

export const upsertViewPreference = async (req, res) => {
  try {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ message: "Invalid preference key" });

    const allowed = VIEW_ALLOWED_COLUMNS[key];
    if (!allowed) return res.status(404).json({ message: "Unknown view key" });

    const defaults = VIEW_DEFAULT_COLUMNS[key] || allowed;

    const columns = normalizeColumns(req.body?.columns, allowed);

    // ✅ If user sends empty -> reset to DEFAULT (not all allowed)
    const finalCols = columns.length ? columns : defaults;

    const doc = await ViewPreference.findOneAndUpdate(
      { userId: req.user._id, key },
      { $set: { columns: finalCols } },
      { new: true, upsert: true }
    ).lean();

    const payload = {
      key,
      allowedColumns: allowed,
      columns: doc.columns,
      updatedAt: doc.updatedAt,
    };

    const etag = hashETag(payload);
    res.setHeader("ETag", etag);

    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: "Failed to save preference", error: err.message });
  }
};
