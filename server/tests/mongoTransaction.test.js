import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  isTransactionUnsupportedError,
  resetMongoTransactionCapability,
  runMongoTransaction,
} from "../utils/mongoTransaction.js";

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const javascriptFiles = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (name === "node_modules") return [];
    return statSync(path).isDirectory()
      ? javascriptFiles(path)
      : name.endsWith(".js")
        ? [path]
        : [];
  });

test("explicit standalone mode executes without creating a transaction", async () => {
  const previous = process.env.MONGO_TRANSACTIONS;
  process.env.MONGO_TRANSACTIONS = "false";
  resetMongoTransactionCapability();
  let calls = 0;
  try {
    const result = await runMongoTransaction(async (session) => {
      calls += 1;
      assert.equal(session, null);
      return "ok";
    });
    assert.equal(result, "ok");
    assert.equal(calls, 1);
  } finally {
    if (previous === undefined) delete process.env.MONGO_TRANSACTIONS;
    else process.env.MONGO_TRANSACTIONS = previous;
    resetMongoTransactionCapability();
  }
});

test("MongoDB standalone transaction errors are recognized", () => {
  assert.equal(
    isTransactionUnsupportedError(
      new Error("Transaction numbers are only allowed on a replica set member or mongos")
    ),
    true
  );
  assert.equal(isTransactionUnsupportedError({ code: 20 }), true);
});

test("production fails closed when transactions are disabled", async () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousMode = process.env.MONGO_TRANSACTIONS;
  process.env.NODE_ENV = "production";
  process.env.MONGO_TRANSACTIONS = "disabled";
  resetMongoTransactionCapability();
  try {
    await assert.rejects(
      () => runMongoTransaction(async () => "unsafe"),
      { code: "MONGO_TRANSACTIONS_INVALID_CONFIGURATION" }
    );
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousMode === undefined) delete process.env.MONGO_TRANSACTIONS;
    else process.env.MONGO_TRANSACTIONS = previousMode;
    resetMongoTransactionCapability();
  }
});

test("production does not execute financial work without transaction capability", async () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousMode = process.env.MONGO_TRANSACTIONS;
  process.env.NODE_ENV = "production";
  delete process.env.MONGO_TRANSACTIONS;
  resetMongoTransactionCapability();
  let executed = false;
  try {
    await assert.rejects(
      () => runMongoTransaction(async () => {
        executed = true;
      }),
      { code: "MONGO_TRANSACTIONS_REQUIRED" }
    );
    assert.equal(executed, false);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousMode === undefined) delete process.env.MONGO_TRANSACTIONS;
    else process.env.MONGO_TRANSACTIONS = previousMode;
    resetMongoTransactionCapability();
  }
});

test("application modules cannot start ad-hoc MongoDB transactions", () => {
  const offenders = javascriptFiles(serverRoot)
    .filter((path) => !path.endsWith(join("utils", "mongoTransaction.js")))
    .filter((path) => !path.includes(`${join("server", "tests")}`))
    .filter((path) => /\.withTransaction\s*\(|\.startTransaction\s*\(/.test(readFileSync(path, "utf8")));
  assert.deepEqual(offenders, []);
});
