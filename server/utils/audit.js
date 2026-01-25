import AuditLog from "../models/auditLog.model.js";
import ActivityLog from "../models/activityLog.model.js";
import ConversionLog from "../models/conversionLog.model.js";

export const getReqMeta = (req) => ({
  ip: String(req.headers["x-forwarded-for"] || req.ip || ""),
  userAgent: String(req.headers["user-agent"] || ""),
  requestId: String(req.headers["x-request-id"] || ""),
});

export const writeAudit = async ({
  session = null,
  actorId,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
  meta = {},
}) => {
  const doc = {
    actorId: actorId ?? null,
    action,
    entityType,
    entityId,
    before,
    after,
    meta,
    createdAt: new Date(),
  };

  if (session) return AuditLog.create([doc], { session });
  return AuditLog.create(doc);
};

export const writeActivity = async ({
  session = null,
  leadId = null,
  customerId = null,
  entityType,
  entityId,
  type,
  message = "",
  meta = null,
  createdBy,
}) => {
  const doc = {
    leadId,
    customerId,
    entityType,
    entityId,
    type,
    message,
    meta,
    createdBy,
    createdAt: new Date(),
  };

  if (session) return ActivityLog.create([doc], { session });
  return ActivityLog.create(doc);
};

export const writeConversionLog = async ({
  session = null,
  leadId,
  customerId,
  convertedBy,
  leadSnapshot,
  customerSnapshot,
}) => {
  const doc = {
    leadId,
    customerId,
    convertedBy,
    convertedAt: new Date(),
    leadSnapshot,
    customerSnapshot,
  };

  if (session) return ConversionLog.create([doc], { session });
  return ConversionLog.create(doc);
};
