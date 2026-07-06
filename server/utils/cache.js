// src/utils/cache.js
import NodeCache from "node-cache";

// Dashboard cache
export const dashboardCache = new NodeCache({
  stdTTL: 15, // seconds (tune: 10-30)
  checkperiod: 30,
  useClones: false,
});

export const accountingCache = new NodeCache({
  stdTTL: 12,
  checkperiod: 30,
  useClones: false,
});


export const invalidateDashboardCache = () => {
  dashboardCache.flushAll();
};

export const invalidateAccountingCache = () => {
  accountingCache.flushAll();
};
