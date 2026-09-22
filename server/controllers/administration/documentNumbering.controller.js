import { asyncAdministrationHandler } from "./administration.controller.js";
import { getReqMeta } from "../../utils/audit.js";
import Company from "../../models/company.model.js";
import {
  getEffectiveRule, listDocumentNumberRules, previewDocumentNumber, updateDocumentNumberRule,
} from "../../services/administration/documentNumbering.service.js";

export const getDocumentNumbering = asyncAdministrationHandler(async (req, res) => {
  const rules = await listDocumentNumberRules({ tenantId: req.tenantId });
  res.json({ success: true, data: { rules } });
});

export const patchDocumentNumbering = asyncAdministrationHandler(async (req, res) => {
  const { revision, ...input } = req.body || {};
  const rule = await updateDocumentNumberRule({
    tenantId: req.tenantId, typeKey: req.params.typeKey,
    input, expectedRevision: revision, actorId: req.user?._id,
    reqMeta: getReqMeta(req),
  });
  res.json({ success: true, message: "Document numbering rule updated.", data: { rule } });
});

export const previewDocumentNumbering = asyncAdministrationHandler(async (req, res) => {
  const { context, serial, date, ...patch } = req.body || {};
  const current = await getEffectiveRule({ tenantId: req.tenantId, typeKey: req.params.typeKey });
  const company = await Company.findById(req.tenantId).select("settings.timezone").lean();
  const preview = await previewDocumentNumber({
    tenantId: req.tenantId, typeKey: req.params.typeKey,
    patch: {
      mode: patch.mode ?? current.mode,
      prefix: patch.prefix ?? current.prefix,
      pattern: patch.pattern ?? current.pattern,
      resetPolicy: patch.resetPolicy ?? current.resetPolicy,
      serialWidth: patch.serialWidth ?? current.serialWidth,
    }, context, serial: serial ?? 1, date: date ?? new Date(), timezone: company?.settings?.timezone || "UTC", currentRule: current,
  });
  res.json({ success: true, data: { preview } });
});
