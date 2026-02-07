// controllers/employeeReportViewPreference.controller.js
import crypto from "crypto";
import EmployeeReportViewPreference from "../models/employeeReportViewPreference.model.js";

const hashETag = (obj) => {
  const str = JSON.stringify(obj || {});
  return crypto.createHash("sha1").update(str).digest("hex");
};

/**
 * ✅ Allowed columns (NO is removed because UI renders it automatically)
 */
const EMPLOYEE_REPORT_VIEW_ALLOWED_COLUMNS = {
  "employeeReport.list": [
    "employee",
    "active",

    "assigned",
    "pending",
    "in_progress",
    "done",

    "range_done",
    "hours",
    "avg_min",

    "rating",
    "actions",
  ],
};

/**
 * ✅ Your requested DEFAULT columns:
 * Employee, Assigned, Pending, In prog, Done, Rating
 */
const EMPLOYEE_REPORT_VIEW_DEFAULT_COLUMNS = {
  "employeeReport.list": ["employee", "assigned", "pending", "in_progress", "done", "rating"],
};

const normalizeColumns = (cols, allowed) => {
  const allowedSet = new Set(allowed);
  const out = [];
  for (const c of cols || []) {
    const v = String(c || "").trim();
    if (!v) continue;
    if (!allowedSet.has(v)) continue;
    out.push(v);
  }
  return [...new Set(out)];
};

export const getEmployeeReportViewPreference = async (req, res) => {
  try {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ message: "Invalid preference key" });

    const allowed = EMPLOYEE_REPORT_VIEW_ALLOWED_COLUMNS[key];
    if (!allowed) return res.status(404).json({ message: "Unknown view key" });

    const defaults = EMPLOYEE_REPORT_VIEW_DEFAULT_COLUMNS[key] || allowed;

    const doc = await EmployeeReportViewPreference.findOne({
      userId: req.user._id,
      key,
    }).lean();

    // ✅ normalize stored columns (prevents old/invalid values causing UI bugs)
    const stored = Array.isArray(doc?.columns) ? doc.columns : [];
    const normalizedStored = stored.length ? normalizeColumns(stored, allowed) : [];

    // ✅ saved -> use it, otherwise -> defaults
    const columns = normalizedStored.length ? normalizedStored : defaults;

    const payload = {
      key,
      allowedColumns: allowed,      // ✅ for "Available columns" + "Show all"
      defaultColumns: defaults,     // ✅ for "Default" button
      columns,                      // ✅ selected columns
      updatedAt: doc?.updatedAt || null,
    };

    const etag = hashETag(payload);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();

    res.setHeader("ETag", etag);
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to get employee report view preference",
      error: err.message,
    });
  }
};

export const upsertEmployeeReportViewPreference = async (req, res) => {
  try {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ message: "Invalid preference key" });

    const allowed = EMPLOYEE_REPORT_VIEW_ALLOWED_COLUMNS[key];
    if (!allowed) return res.status(404).json({ message: "Unknown view key" });

    const defaults = EMPLOYEE_REPORT_VIEW_DEFAULT_COLUMNS[key] || allowed;

    // ✅ normalize input; [] => reset to defaults
    const normalized = normalizeColumns(req.body?.columns, allowed);
    const finalCols = normalized.length ? normalized : defaults;

    const doc = await EmployeeReportViewPreference.findOneAndUpdate(
      { userId: req.user._id, key },
      { $set: { columns: finalCols } },
      { new: true, upsert: true }
    ).lean();

    const payload = {
      key,
      allowedColumns: allowed,
      defaultColumns: defaults,
      columns: doc?.columns || finalCols,
      updatedAt: doc?.updatedAt || null,
    };

    const etag = hashETag(payload);
    res.setHeader("ETag", etag);

    return res.json(payload);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to save employee report view preference",
      error: err.message,
    });
  }
};
