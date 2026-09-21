import assert from "node:assert/strict";
import test from "node:test";

import { app } from "../../app.js";

async function startApp(t) {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test("canonical Administration resources require authentication", async (t) => {
  const origin = await startApp(t);
  const requests = [
    ["GET", "/api/administration/company"],
    ["PATCH", "/api/administration/company"],
    ["PUT", "/api/administration/company/logo"],
    ["DELETE", "/api/administration/company/logo"],
    ["GET", "/api/administration/settings"],
    ["PATCH", "/api/administration/settings"],
    ["GET", "/api/administration/dashboard"],
  ];

  for (const [method, path] of requests) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: ["PATCH", "PUT"].includes(method) ? JSON.stringify({}) : undefined,
    });
    const payload = await response.json();
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.match(payload.message, /token missing/i, `${method} ${path}`);
  }
});
