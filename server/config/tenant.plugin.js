import mongoose from "mongoose";
import { getTenantContext, sameTenant } from "./tenantContext.js";
import { DOCUMENT_NUMBER_TYPES } from "./documentNumberTypes.js";

// Tenant middleware belongs on persisted root models, not embedded schemas.
// Applying it to child schemas creates invalid paths such as
// shippingAddress.tenantId and can exhaust MongoDB's index limit.
mongoose.set("applyPluginsToChildSchemas", false);

const QUERY_OPERATIONS = [
  "countDocuments", "deleteMany", "deleteOne", "distinct", "find", "findOne",
  "findOneAndDelete", "findOneAndReplace", "findOneAndUpdate", "replaceOne",
  "updateMany", "updateOne",
];

const tenantError = () => new Error("A verified tenant membership is required for this operation.");
const tenantScopedCollectionNames = () => new Set(
  mongoose.modelNames()
    .map((modelName) => mongoose.model(modelName))
    .filter((model) => model.schema.path("tenantId") && model.schema.options.tenantScoped !== false)
    .map((model) => model.collection.name)
);

const scopeJoinedPipelines = (stages, tenantId, scopedCollections) => {
  for (const stage of stages || []) {
    if (stage.$lookup) {
      if (scopedCollections.has(stage.$lookup.from)) {
        stage.$lookup.pipeline = [
          { $match: { tenantId } },
          ...(stage.$lookup.pipeline || []),
        ];
      }
      scopeJoinedPipelines(stage.$lookup.pipeline, tenantId, scopedCollections);
    }
    if (stage.$facet) {
      for (const pipeline of Object.values(stage.$facet)) scopeJoinedPipelines(pipeline, tenantId, scopedCollections);
    }
    if (stage.$unionWith?.coll && scopedCollections.has(stage.$unionWith.coll)) {
      stage.$unionWith.pipeline = [
        { $match: { tenantId } },
        ...(stage.$unionWith.pipeline || []),
      ];
      scopeJoinedPipelines(stage.$unionWith.pipeline, tenantId, scopedCollections);
    }
  }
};
const mongoTypeForPath = (schema, pathName) => {
  const instance = schema.path(pathName)?.instance;
  return { String: "string", ObjectId: "objectId", Number: "number", Date: "date", Boolean: "bool" }[instance] || null;
};

const optionalUniqueFilter = (schema, fields) => Object.fromEntries(
  Object.keys(fields)
    .filter((pathName) => pathName !== "tenantId")
    .map((pathName) => {
      const type = mongoTypeForPath(schema, pathName);
      return [pathName, type ? { $type: type } : { $exists: true }];
    })
);

export const compactTenantIndexes = (schema) => {
  const deduplicated = new Map();
  for (const [fields, options = {}] of schema._indexes || []) {
    const signature = JSON.stringify(fields);
    const current = deduplicated.get(signature);
    if (!current || (options.unique === true && current[1]?.unique !== true)) {
      deduplicated.set(signature, [fields, options]);
    }
  }
  schema._indexes = [...deduplicated.values()];

  schema._indexes = schema._indexes.filter(([fields, options = {}], index, all) => {
    if (options.unique || options.partialFilterExpression || Object.values(fields).includes("text")) return true;
    const entries = Object.entries(fields);
    return !all.some(([otherFields, otherOptions = {}], otherIndex) => {
      if (otherIndex === index || otherOptions.unique || otherOptions.partialFilterExpression || Object.values(otherFields).includes("text")) return false;
      const otherEntries = Object.entries(otherFields);
      return otherEntries.length > entries.length && entries.every(([key, direction], offset) => {
        const other = otherEntries[offset];
        return other?.[0] === key && other?.[1] === direction;
      });
    });
  });

  const coveredPrefixes = new Set(
    schema._indexes
      .filter(([fields]) => !Object.values(fields).includes("text"))
      .map(([fields]) => Object.keys(fields)[0])
  );
  schema.eachPath((pathName, schemaType) => {
    const index = schemaType?._index;
    if (!index || index.unique === true || !coveredPrefixes.has(pathName)) return;
    schemaType._index = null;
  });
};

export const clearEmbeddedPathIndexes = (schema) => {
  for (const child of schema.childSchemas || []) {
    child.schema.eachPath((_pathName, schemaType) => {
      if (schemaType?._index && schemaType._index?.unique !== true) schemaType._index = null;
    });
    clearEmbeddedPathIndexes(child.schema);
  }
};

function tenantPlugin(schema) {
  if (schema.options.tenantScoped === false) return;

  if (!schema.path("tenantId")) {
    schema.add({
      tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        default: null,
        index: true,
      },
    });
  }

  schema.index({ tenantId: 1, createdAt: -1, _id: -1 });

  // Unique business keys belong to a tenant. Preserve only explicitly global keys
  // (the current login architecture keeps email globally unique).
  const globalUniquePaths = new Set(schema.options.tenantGlobalUniquePaths || []);
  const compoundKeys = new Set();
  schema.eachPath((pathName, schemaType) => {
    if (schemaType?.options?.unique !== true || globalUniquePaths.has(pathName) || pathName === "tenantId") return;
    delete schemaType.options.unique;
    schemaType._index = null;
    const key = JSON.stringify({ tenantId: 1, [pathName]: 1 });
    if (!compoundKeys.has(key)) {
      const options = { unique: true };
      if (schemaType.options.sparse === true) {
        options.partialFilterExpression = optionalUniqueFilter(schema, { [pathName]: 1 });
      }
      schema.index({ tenantId: 1, [pathName]: 1 }, options);
      compoundKeys.add(key);
    }
  });
  schema._indexes = (schema._indexes || []).map(([fields, options]) => {
    if (!options?.unique || fields.tenantId || Object.keys(fields).every((path) => globalUniquePaths.has(path))) {
      return [fields, options];
    }
    const nextOptions = { ...options };
    if (nextOptions.sparse === true) {
      delete nextOptions.sparse;
      nextOptions.partialFilterExpression = nextOptions.partialFilterExpression || optionalUniqueFilter(schema, fields);
    }
    return [{ tenantId: 1, ...fields }, nextOptions];
  });
  compactTenantIndexes(schema);

  schema.pre(QUERY_OPERATIONS, function tenantQueryScope(next) {
    const context = getTenantContext();
    if (!context || context.bypassTenant === true) return next();
    if (!context.tenantId) return next(tenantError());

    const query = this.getQuery() || {};
    if (query.tenantId && !sameTenant(query.tenantId, context.tenantId)) {
      return next(new Error("Cross-tenant access is not allowed."));
    }
    this.where({ tenantId: context.tenantId });

    const update = this.getUpdate?.();
    if (update && typeof update === "object") {
      delete update.tenantId;
      if (update.$set) delete update.$set.tenantId;
      update.$setOnInsert = { ...(update.$setOnInsert || {}), tenantId: context.tenantId };
      this.setUpdate(update);
    }
    return next();
  });

  schema.pre("aggregate", function tenantAggregateScope(next) {
    const context = getTenantContext();
    if (!context || context.bypassTenant === true) return next();
    if (!context.tenantId) return next(tenantError());
    const tenantId = new mongoose.Types.ObjectId(String(context.tenantId));
    const match = { $match: { tenantId } };
    const pipeline = this.pipeline();
    pipeline.splice(pipeline[0]?.$geoNear ? 1 : 0, 0, match);
    scopeJoinedPipelines(pipeline, tenantId, tenantScopedCollectionNames());
    return next();
  });

  schema.pre("save", function tenantDocumentScope(next) {
    const context = getTenantContext();
    if (!context || context.bypassTenant === true) return next();
    if (!context.tenantId) return next(tenantError());
    if (this.tenantId && !sameTenant(this.tenantId, context.tenantId)) {
      return next(new Error("Cross-tenant access is not allowed."));
    }
    this.tenantId = context.tenantId;
    return next();
  });

  schema.pre("insertMany", function tenantInsertManyScope(next, docs) {
    const context = getTenantContext();
    if (!context || context.bypassTenant === true) return next();
    if (!context.tenantId) return next(tenantError());
    for (const document of docs || []) {
      if (document.tenantId && !sameTenant(document.tenantId, context.tenantId)) {
        return next(new Error("Cross-tenant access is not allowed."));
      }
      document.tenantId = context.tenantId;
    }
    return next();
  });

  schema.pre("bulkWrite", function tenantBulkWriteScope(next, operations) {
    const context = getTenantContext();
    if (!context || context.bypassTenant === true) return next();
    if (!context.tenantId) return next(tenantError());
    for (const operation of operations || []) {
      const type = Object.keys(operation || {})[0];
      const command = operation?.[type];
      if (!command) continue;
      if (type === "insertOne") {
        command.document = { ...(command.document || {}), tenantId: context.tenantId };
        continue;
      }
      if (command.filter) command.filter = { ...command.filter, tenantId: context.tenantId };
      if (command.replacement) command.replacement = { ...command.replacement, tenantId: context.tenantId };
      if (command.update && typeof command.update === "object") {
        delete command.update.tenantId;
        if (command.update.$set) delete command.update.$set.tenantId;
        command.update.$setOnInsert = { ...(command.update.$setOnInsert || {}), tenantId: context.tenantId };
      }
    }
    return next();
  });

  const numberedFields = DOCUMENT_NUMBER_TYPES.filter((type) => schema.path(type.field));
  if (numberedFields.length) {
    schema.post("save", async function linkNumberClaimToRecord() {
      const claimModel = mongoose.models.DocumentNumberClaim;
      if (!claimModel || !this.tenantId) return;
      for (const type of numberedFields) {
        const value = type.model === this.constructor.modelName && this[type.field];
        if (!value) continue;
        await claimModel.collection.updateOne(
          { tenantId: this.tenantId, typeKey: type.key, value: String(value).trim().toUpperCase(), recordId: null },
          { $set: { recordId: this._id } },
          { session: this.$session?.() || undefined },
        );
      }
    });
  }
}

mongoose.plugin(tenantPlugin);

export default tenantPlugin;
