import mongoose from "mongoose";

export class ManufacturingError extends Error {
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.name = "ManufacturingError";
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, ManufacturingError);
  }
}

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export const assertTenant = (req) => {
  if (!req.tenantId) throw new ManufacturingError("A verified company membership is required.", 403);
  return req.tenantId;
};

export const clean = (value) => String(value ?? "").trim();
export const upper = (value) => clean(value).toUpperCase();
export const lower = (value) => clean(value).toLowerCase();
export const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
export const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export const asDate = (value, fallback = null) => {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
};
export const pageParams = (req) => ({
  page: Math.max(1, Number(req.query.page || 1)),
  limit: Math.min(100, Math.max(1, Number(req.query.limit || 25))),
});
