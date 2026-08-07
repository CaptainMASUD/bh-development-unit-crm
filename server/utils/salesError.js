export class SalesError extends Error {
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.name = "SalesError";
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, SalesError);
  }
}

const normalizeSalesError = (error) => {
  if (error instanceof SalesError) return error;

  if (error?.name === "ValidationError") {
    return new SalesError(
      "Validation failed.",
      422,
      Object.values(error.errors || {}).map((item) => ({
        field: item.path,
        message: item.message,
      }))
    );
  }

  if (error?.name === "CastError") {
    return new SalesError(`Invalid ${error.path || "identifier"}.`, 400);
  }

  if (error?.code === 11000) {
    return new SalesError(
      "A sales document with this number already exists.",
      409,
      error.keyValue
    );
  }

  return error;
};

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch((error) => next(normalizeSalesError(error)));

export const assertTenant = (req) => {
  // The authentication middleware resolves this value from a verified active
  // membership. Never trust tenantId supplied by the request body or query.
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new SalesError("A verified company membership is required.", 403);
  }
  return tenantId;
};
