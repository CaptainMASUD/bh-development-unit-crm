import AuditLog from "../models/auditLog.model.js";
import ActivityLog from "../models/activityLog.model.js";
import ConversionLog from "../models/conversionLog.model.js";

export const getReqMeta = (req = {}) => {
  return {
    ip:
      req?.headers?.["x-forwarded-for"]?.split(",")?.[0]?.trim() ||
      req?.socket?.remoteAddress ||
      "",
    userAgent: req?.headers?.["user-agent"] || "",
    method: req?.method || "",
    path: req?.originalUrl || req?.url || "",
  };
};

const normalizeAuditAction = (action = "") => {
  const value = String(action || "").trim();

  const map = {
    stage_changed: "stage_change",
    status_changed: "status_change",
    converted: "convert",
    completed: "complete",
    cancelled: "cancel",
    sent: "send",
    accepted: "accept",
    rejected: "reject",
  };

  return map[value] || value;
};

const normalizeActivityType = (type = "") => {
  const value = String(type || "").trim();

  const map = {
    stage_change: "stage_changed",
    status_change: "status_changed",
    convert: "converted",
    complete: "activity_completed",
    cancel: "activity_cancelled",
  };

  return map[value] || value;
};

export const writeAudit = async ({
  session = null,
  tenantId = null,
  actorId,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
  meta = {},
}) => {
  try {
    if (!actorId || !action || !entityType || !entityId) return null;

    const payload = {
      ...(tenantId ? { tenantId } : meta?.tenantId ? { tenantId: meta.tenantId } : {}),
      actorId,
      action: normalizeAuditAction(action),
      entityType,
      entityId,
      before,
      after,
      meta: {
        ip: meta?.ip || "",
        userAgent: meta?.userAgent || "",
        method: meta?.method || "",
        path: meta?.path || "",
        oldStage: meta?.oldStage || "",
        newStage: meta?.newStage || "",
        oldStatus: meta?.oldStatus || "",
        newStatus: meta?.newStatus || "",
        reason: meta?.reason || "",
        amount: Number(meta?.amount || 0),
        extra: meta?.extra || null,
      },
    };

    if (session) {
      const [doc] = await AuditLog.create([payload], { session });
      return doc;
    }

    return await AuditLog.create(payload);
  } catch (err) {
    console.error("Audit log failed:", err.message);
    return null;
  }
};

export const writeActivity = async ({
  session = null,
  leadId = null,
  customerId = null,
  dealId = null,
  orderId = null,
  invoiceId = null,
  proposalId = null,
  entityType,
  entityId,
  type,
  message = "",
  createdBy,
  meta = {},
}) => {
  try {
    if (!entityType || !entityId || !type || !createdBy) return null;

    const payload = {
      leadId,
      customerId,
      dealId,
      orderId,
      invoiceId,
      proposalId,
      entityType,
      entityId,
      type: normalizeActivityType(type),
      message,
      createdBy,
      meta: {
        oldStage: meta?.oldStage || "",
        newStage: meta?.newStage || "",
        oldStatus: meta?.oldStatus || "",
        newStatus: meta?.newStatus || "",
        reason: meta?.reason || "",
        amount: Number(meta?.amount || 0),
        extra: meta || null,
      },
    };

    if (session) {
      const [doc] = await ActivityLog.create([payload], { session });
      return doc;
    }

    return await ActivityLog.create(payload);
  } catch (err) {
    console.error("Activity log failed:", err.message);
    return null;
  }
};

export const writeConversionLog = async ({
  session = null,
  leadId,
  customerId,
  convertedBy,
  leadSnapshot = null,
  customerSnapshot = null,
}) => {
  try {
    if (!leadId || !customerId || !convertedBy) return null;

    const payload = {
      leadId,
      customerId,
      convertedBy,
      leadSnapshot,
      customerSnapshot,
    };

    if (session) {
      const [doc] = await ConversionLog.create([payload], { session });
      return doc;
    }

    return await ConversionLog.create(payload);
  } catch (err) {
    console.error("Conversion log failed:", err.message);
    return null;
  }
};