import assert from "node:assert/strict";
import test from "node:test";

import { app } from "../app.js";

test("public login is not intercepted by a tenant module guard", async (t) => {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/users/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.message, "Email and password are required.");
});

test("explicit ERP route mounts preserve existing URLs", async (t) => {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const { port } = server.address();
  const paths = [
    "/api/task-templates",
    "/api/customers/000000000000000000000000/tasks",
    "/api/customers/000000000000000000000000/draft",
    "/api/notifications/deadlines",
    "/api/dashboard/administration",
  ];

  for (const path of paths) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const payload = await response.json();
    assert.equal(response.status, 401, path);
    assert.match(payload.message, /token missing/i, path);
  }
});
