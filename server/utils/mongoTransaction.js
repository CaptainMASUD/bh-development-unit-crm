import mongoose from "mongoose";

const TRANSACTION_OPTIONS = Object.freeze({
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority", wtimeoutMS: 10_000 },
  readPreference: "primary",
  maxCommitTimeMS: 10_000,
});

let cachedCapability = null;

const requiredCapabilityError = (topology) => Object.assign(
  new Error(`MongoDB transactions are required, but the detected topology is ${topology}.`),
  { code: "MONGO_TRANSACTIONS_REQUIRED" }
);

const configuredMode = () => {
  const defaultMode = process.env.NODE_ENV === "production" ? "required" : "auto";
  const value = String(process.env.MONGO_TRANSACTIONS || defaultMode).trim().toLowerCase();
  if (["false", "off", "disabled", "0"].includes(value)) {
    if (process.env.NODE_ENV === "production") {
      throw Object.assign(
        new Error("MongoDB transactions cannot be disabled in production."),
        { code: "MONGO_TRANSACTIONS_INVALID_CONFIGURATION" }
      );
    }
    return "disabled";
  }
  if (["true", "on", "required", "1"].includes(value)) return "required";
  if (value === "auto") return "auto";
  throw Object.assign(
    new Error(`Invalid MONGO_TRANSACTIONS mode: ${value}.`),
    { code: "MONGO_TRANSACTIONS_INVALID_CONFIGURATION" }
  );
};

export const isTransactionUnsupportedError = (error) =>
  error?.code === 20 ||
  error?.codeName === "IllegalOperation" ||
  /transaction numbers are only allowed on a replica set member or mongos/i.test(
    String(error?.message || "")
  );

export const getMongoTransactionCapability = async ({ refresh = false } = {}) => {
  const mode = configuredMode();
  if (mode === "disabled") {
    cachedCapability = { supported: false, mode, topology: "disabled-by-configuration" };
    return cachedCapability;
  }
  if (!refresh && cachedCapability) return cachedCapability;
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    const capability = { supported: false, mode, topology: "disconnected" };
    if (mode === "required") throw requiredCapabilityError(capability.topology);
    return capability;
  }

  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    const supported = Boolean(hello?.setName || hello?.msg === "isdbgrid");
    const topology = hello?.msg === "isdbgrid"
      ? "mongos"
      : hello?.setName
        ? `replica-set:${hello.setName}`
        : "standalone";
    cachedCapability = { supported, mode, topology };
  } catch (error) {
    cachedCapability = { supported: false, mode, topology: "unknown", error: error.message };
  }

  if (mode === "required" && !cachedCapability.supported) {
    throw requiredCapabilityError(cachedCapability.topology);
  }
  return cachedCapability;
};

export const resetMongoTransactionCapability = () => {
  cachedCapability = null;
};

export const runMongoTransaction = async (work, options = TRANSACTION_OPTIONS) => {
  const capability = await getMongoTransactionCapability();
  if (!capability.supported) return work(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    }, options);
    return result;
  } catch (error) {
    if (!isTransactionUnsupportedError(error) || configuredMode() === "required") throw error;

    // Never replay a business callback automatically: it may contain an
    // external side effect or a non-idempotent write. Cache the corrected
    // capability and ask the caller to retry the request once instead.
    cachedCapability = { supported: false, mode: "auto", topology: "standalone" };
    throw Object.assign(
      new Error("MongoDB topology changed while starting the transaction. Retry the request."),
      { statusCode: 503, code: "MONGO_TRANSACTION_TOPOLOGY_CHANGED", cause: error }
    );
  } finally {
    await session.endSession();
  }
};

export const sessionOptions = (session) => (session ? { session } : {});
export const withSession = (query, session) => (session ? query.session(session) : query);
