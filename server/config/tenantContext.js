import { AsyncLocalStorage } from "node:async_hooks";

const tenantStorage = new AsyncLocalStorage();

export const getTenantContext = () => tenantStorage.getStore() || null;

export const runWithTenant = (context, callback) =>
  tenantStorage.run(Object.freeze({ ...context }), callback);

export const sameTenant = (left, right) =>
  Boolean(left && right && String(left) === String(right));

