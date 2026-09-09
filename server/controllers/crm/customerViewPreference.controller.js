import crypto from "crypto";
import CustomerViewPreference from "../../models/customerViewPreference.model.js";

const hashETag = (obj) => {
  const str = JSON.stringify(obj || {});
  return crypto.createHash("sha1").update(str).digest("hex");
};

/**
 * ✅ Allowed columns for each view-key
 * NOTE: engagementLatest* are computed in GET /customers (see updated getCustomers below)
 */
const CUSTOMER_VIEW_ALLOWED_COLUMNS = {
  "customers.list": [
    // base
    "name",
    "companyName",
    "email",
    "phone",
    "address",

    // contact person
    "contactPerson.name",
    "contactPerson.email",
    "contactPerson.phone",
    "contactPerson.designation",

    // statuses
    "status",
    "customerType",
    "lifecycleStage",
    "origin",

    // tags + relations
    "tags",
    "leadId",
    "assignedTo",
    "createdBy",

    // timestamps
    "createdAt",
    "updatedAt",

    // optional counts
    "jobsCount",
    "tasksCount",

    // ✅ computed engagement summary
    "engagementLatestYear",
    "engagementLatestTemplateId",
    "engagementLatestTemplateTitle",
    "engagementLatestSubEngagementIds",
  ],
};

/**
 * ✅ Default selected columns per view-key
 */
const CUSTOMER_VIEW_DEFAULT_COLUMNS = {
  "customers.list": [
    "name",
    "companyName",
    "status",
    "customerType",
    "lifecycleStage",
    "engagementLatestYear",
    "engagementLatestTemplateTitle",
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

  // de-dupe keeping order
  return [...new Set(out)];
};

export const getCustomerViewPreference = async (req, res) => {
  try {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ message: "Invalid preference key" });

    const allowed = CUSTOMER_VIEW_ALLOWED_COLUMNS[key];
    if (!allowed) return res.status(404).json({ message: "Unknown view key" });

    const defaults = CUSTOMER_VIEW_DEFAULT_COLUMNS[key] || allowed;

    const doc = await CustomerViewPreference.findOne({ userId: req.user._id, key }).lean();

    const payload = {
      key,
      allowedColumns: allowed,
      columns: Array.isArray(doc?.columns) && doc.columns.length ? doc.columns : defaults,
      updatedAt: doc?.updatedAt || null,
    };

    const etag = hashETag(payload);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();

    res.setHeader("ETag", etag);
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: "Failed to get customer view preference", error: err.message });
  }
};

export const upsertCustomerViewPreference = async (req, res) => {
  try {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ message: "Invalid preference key" });

    const allowed = CUSTOMER_VIEW_ALLOWED_COLUMNS[key];
    if (!allowed) return res.status(404).json({ message: "Unknown view key" });

    const defaults = CUSTOMER_VIEW_DEFAULT_COLUMNS[key] || allowed;

    const columns = normalizeColumns(req.body?.columns, allowed);

    // ✅ if empty array => reset to DEFAULT
    const finalCols = columns.length ? columns : defaults;

    const doc = await CustomerViewPreference.findOneAndUpdate(
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
    return res.status(500).json({ message: "Failed to save customer view preference", error: err.message });
  }
};
