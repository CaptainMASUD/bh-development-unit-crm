import mongoose from "mongoose";
import { getTenantContext } from "./tenantContext.js";
import {
  computeFieldDiff,
  EXCLUDED_AUDIT_MODELS,
  getModuleForModel,
  getRecordIdentifier,
} from "./auditRegistry.js";
import { redactAuditValue } from "../utils/auditRedaction.js";

function extractInitialChanges(obj = {}) {
  const ignored = new Set(["_id", "__v", "createdAt", "updatedAt", "_originalState", "_wasNew", "_auditChanges", "_auditBefore", "_auditAfter", "_skipAutoAudit"]);
  const changes = [];
  for (const [key, value] of Object.entries(obj)) {
    if (ignored.has(key)) continue;
    changes.push({
      path: key,
      before: null,
      after: redactAuditValue(value),
    });
  }
  return changes;
}

export function auditPlugin(schema) {
  schema.post("init", function onInitCaptureOriginal() {
    try {
      this._originalState = this.toObject({ depopulate: true });
    } catch {
      this._originalState = null;
    }
  });

  schema.pre("save", function onPreSaveComputeDiff(next) {
    if (this.isNew) {
      this._wasNew = true;
    } else if (this._originalState) {
      const modified = this.modifiedPaths();
      const current = this.toObject({ depopulate: true });
      const diff = computeFieldDiff(this._originalState, current, modified);
      this._auditChanges = diff.changes;
      this._auditBefore = diff.before;
      this._auditAfter = diff.after;
    }
    return next();
  });

  schema.post("save", async function onPostSaveAudit() {
    if (this._skipAutoAudit) return;
    const modelName = this.constructor.modelName;
    if (!modelName || EXCLUDED_AUDIT_MODELS.has(modelName)) return;

    const ctx = getTenantContext();
    const tenantId = this.tenantId || ctx?.tenantId || null;
    const actorId = ctx?.userId || ctx?.user?._id || this.updatedBy || this.createdBy || null;
    const actorName =
      ctx?.user?.name ||
      (ctx?.user?.firstName ? `${ctx.user.firstName} ${ctx.user.lastName || ""}`.trim() : "") ||
      ctx?.user?.username ||
      (actorId ? "User" : "System");
    const actorEmail = ctx?.user?.email || "";
    const actorRole = ctx?.user?.role || "";
    const meta = { ...(ctx?.reqMeta || {}) };

    const moduleName = getModuleForModel(modelName);
    const recordIdentifier = getRecordIdentifier(this);
    const AuditLog = mongoose.models.AuditLog;
    if (!AuditLog) return;

    try {
      const session = this.$session?.() || undefined;

      if (this._wasNew) {
        const payload = {
          tenantId,
          actorId,
          actorName,
          actorEmail,
          actorRole,
          action: "create",
          module: moduleName,
          entityType: modelName,
          entityId: this._id,
          recordIdentifier,
          changes: extractInitialChanges(this.toObject({ depopulate: true })),
          before: null,
          after: redactAuditValue(this.toObject()),
          meta,
          createdAt: new Date(),
        };
        if (session) {
          await AuditLog.create([payload], { session });
        } else {
          await AuditLog.create(payload);
        }
      } else if (this._auditChanges && this._auditChanges.length > 0) {
        const payload = {
          tenantId,
          actorId,
          actorName,
          actorEmail,
          actorRole,
          action: "update",
          module: moduleName,
          entityType: modelName,
          entityId: this._id,
          recordIdentifier,
          changes: this._auditChanges,
          before: this._auditBefore,
          after: this._auditAfter,
          meta,
          createdAt: new Date(),
        };
        if (session) {
          await AuditLog.create([payload], { session });
        } else {
          await AuditLog.create(payload);
        }
      }
    } catch (err) {
      console.error(`Automatic audit failed for ${modelName}:`, err.message);
    }
  });

  schema.post("deleteOne", { document: true, query: false }, async function onDocumentDeleteAudit() {
    if (this._skipAutoAudit) return;
    const modelName = this.constructor.modelName;
    if (!modelName || EXCLUDED_AUDIT_MODELS.has(modelName)) return;

    const ctx = getTenantContext();
    const tenantId = this.tenantId || ctx?.tenantId || null;
    const actorId = ctx?.userId || ctx?.user?._id || this.updatedBy || this.createdBy || null;
    const actorName = ctx?.user?.name || (actorId ? "User" : "System");
    const actorEmail = ctx?.user?.email || "";
    const actorRole = ctx?.user?.role || "";
    const meta = { ...(ctx?.reqMeta || {}) };

    const moduleName = getModuleForModel(modelName);
    const recordIdentifier = getRecordIdentifier(this);
    const AuditLog = mongoose.models.AuditLog;
    if (!AuditLog) return;

    try {
      const session = this.$session?.() || undefined;
      const payload = {
        tenantId,
        actorId,
        actorName,
        actorEmail,
        actorRole,
        action: "delete",
        module: moduleName,
        entityType: modelName,
        entityId: this._id,
        recordIdentifier,
        changes: [],
        before: redactAuditValue(this.toObject()),
        after: null,
        meta,
        createdAt: new Date(),
      };
      if (session) {
        await AuditLog.create([payload], { session });
      } else {
        await AuditLog.create(payload);
      }
    } catch (err) {
      console.error(`Automatic delete audit failed for ${modelName}:`, err.message);
    }
  });

  schema.pre("findOneAndUpdate", async function onPreFindOneAndUpdate() {
    try {
      const modelName = this.model?.modelName;
      if (!modelName || EXCLUDED_AUDIT_MODELS.has(modelName) || this.getOptions()?.skipAudit) return;
      this._beforeDoc = await this.model.findOne(this.getQuery()).lean();
    } catch {
      this._beforeDoc = null;
    }
  });

  schema.post("findOneAndUpdate", async function onPostFindOneAndUpdate(doc) {
    if (this.getOptions()?.skipAudit) return;
    const modelName = this.model?.modelName;
    if (!modelName || EXCLUDED_AUDIT_MODELS.has(modelName)) return;
    if (!this._beforeDoc) return;

    const AuditLog = mongoose.models.AuditLog;
    if (!AuditLog) return;

    try {
      const afterDoc = doc ? doc.toObject?.() || doc : await this.model.findById(this._beforeDoc._id).lean();
      if (!afterDoc) return;

      const diff = computeFieldDiff(this._beforeDoc, afterDoc);
      if (!diff.changes.length) return;

      const ctx = getTenantContext();
      const tenantId = afterDoc.tenantId || this._beforeDoc.tenantId || ctx?.tenantId || null;
      const actorId = ctx?.userId || ctx?.user?._id || afterDoc.updatedBy || null;
      const actorName = ctx?.user?.name || (actorId ? "User" : "System");
      const actorEmail = ctx?.user?.email || "";
      const actorRole = ctx?.user?.role || "";
      const meta = { ...(ctx?.reqMeta || {}) };

      const moduleName = getModuleForModel(modelName);
      const recordIdentifier = getRecordIdentifier(afterDoc);
      const session = this.getOptions()?.session || undefined;

      const payload = {
        tenantId,
        actorId,
        actorName,
        actorEmail,
        actorRole,
        action: "update",
        module: moduleName,
        entityType: modelName,
        entityId: afterDoc._id,
        recordIdentifier,
        changes: diff.changes,
        before: diff.before,
        after: diff.after,
        meta,
        createdAt: new Date(),
      };

      if (session) {
        await AuditLog.create([payload], { session });
      } else {
        await AuditLog.create(payload);
      }
    } catch (err) {
      console.error(`Automatic query update audit failed for ${modelName}:`, err.message);
    }
  });

  schema.pre("findOneAndDelete", async function onPreFindOneAndDelete() {
    try {
      const modelName = this.model?.modelName;
      if (!modelName || EXCLUDED_AUDIT_MODELS.has(modelName) || this.getOptions()?.skipAudit) return;
      this._beforeDoc = await this.model.findOne(this.getQuery()).lean();
    } catch {
      this._beforeDoc = null;
    }
  });

  schema.post("findOneAndDelete", async function onPostFindOneAndDelete() {
    if (this.getOptions()?.skipAudit) return;
    const modelName = this.model?.modelName;
    if (!modelName || EXCLUDED_AUDIT_MODELS.has(modelName)) return;
    if (!this._beforeDoc) return;

    const AuditLog = mongoose.models.AuditLog;
    if (!AuditLog) return;

    try {
      const ctx = getTenantContext();
      const tenantId = this._beforeDoc.tenantId || ctx?.tenantId || null;
      const actorId = ctx?.userId || ctx?.user?._id || null;
      const actorName = ctx?.user?.name || (actorId ? "User" : "System");
      const actorEmail = ctx?.user?.email || "";
      const actorRole = ctx?.user?.role || "";
      const meta = { ...(ctx?.reqMeta || {}) };

      const moduleName = getModuleForModel(modelName);
      const recordIdentifier = getRecordIdentifier(this._beforeDoc);
      const session = this.getOptions()?.session || undefined;

      const payload = {
        tenantId,
        actorId,
        actorName,
        actorEmail,
        actorRole,
        action: "delete",
        module: moduleName,
        entityType: modelName,
        entityId: this._beforeDoc._id,
        recordIdentifier,
        changes: [],
        before: redactAuditValue(this._beforeDoc),
        after: null,
        meta,
        createdAt: new Date(),
      };

      if (session) {
        await AuditLog.create([payload], { session });
      } else {
        await AuditLog.create(payload);
      }
    } catch (err) {
      console.error(`Automatic delete audit failed for ${modelName}:`, err.message);
    }
  });
}

mongoose.plugin(auditPlugin);

export default auditPlugin;
