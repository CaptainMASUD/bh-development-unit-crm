import {
  approveSupplierService,
  archiveSupplierProductService,
  archiveSupplierService,
  createSupplierProductService,
  createSupplierService,
  getSupplierProductService,
  getSupplierService,
  getSupplierSummaryService,
  listSupplierAuditsService,
  listSupplierOptionsService,
  listSupplierProductsService,
  listSuppliersService,
  lookupSupplierService,
  rejectSupplierService,
  restoreSupplierProductService,
  restoreSupplierService,
  submitSupplierService,
  supplierReferenceData,
  updateSupplierProductService,
  updateSupplierProductStatusService,
  updateSupplierService,
  updateSupplierStatusService,
} from "../../services/supplier.service.js";

const actorId = (req) => req.user?._id || req.user?.id || null;

const requestMeta = (req) => ({
  requestId:
    req.id ||
    req.requestId ||
    req.headers["x-request-id"] ||
    "",
  ip:
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "",
  userAgent: req.headers["user-agent"] || "",
});

const duplicateMessage = (error) => {
  const fields = Object.keys(
    error?.keyPattern || error?.keyValue || {}
  );

  if (fields.includes("code")) {
    return "A supplier with this code already exists.";
  }

  if (fields.includes("supplier") && fields.includes("product")) {
    return "This supplier is already linked to the selected product.";
  }

  if (fields.includes("product") && fields.includes("isPreferred")) {
    return "The selected product already has another preferred supplier.";
  }

  return "A supplier record with the same unique value already exists.";
};

const sendError = (res, error, fallbackMessage) => {
  if (error?.code === 11000) {
    return res.status(409).json({
      message: duplicateMessage(error),
      ...(process.env.NODE_ENV !== "production"
        ? { error: error.message }
        : {}),
    });
  }

  if (
    error?.name === "ValidationError" ||
    error?.name === "CastError" ||
    error?.name === "VersionError"
  ) {
    return res.status(error?.name === "VersionError" ? 409 : 400).json({
      message:
        error?.name === "VersionError"
          ? "The supplier record changed while you were editing it. Reload and try again."
          : error.message,
      ...(process.env.NODE_ENV !== "production"
        ? { error: error.message }
        : {}),
    });
  }

  const status = Number(error?.statusCode) || 500;
  const payload = {
    message: error?.statusCode ? error.message : fallbackMessage,
  };

  if (Array.isArray(error?.errors)) payload.errors = error.errors;
  if (error?.details) payload.details = error.details;

  if (process.env.NODE_ENV !== "production") {
    payload.error = error?.message || fallbackMessage;
  }

  return res.status(status).json(payload);
};

const setNoStore = (res) => {
  res.set("Cache-Control", "no-store");
};

const setReadCache = (res, seconds) => {
  res.set(
    "Cache-Control",
    `private, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`
  );
};

export const getSupplierReferenceData = async (_req, res) => {
  setReadCache(res, 300);
  return res.json(supplierReferenceData);
};

export const listSuppliers = async (req, res) => {
  try {
    setNoStore(res);
    return res.json(await listSuppliersService(req.query));
  } catch (error) {
    return sendError(res, error, "Failed to load suppliers.");
  }
};

export const listSupplierOptions = async (req, res) => {
  try {
    setReadCache(res, 60);
    return res.json(
      await listSupplierOptionsService({
        ...req.query,
        _verifiedTenantId: req.tenantId,
      })
    );
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to load supplier options."
    );
  }
};

export const getSupplierSummary = async (req, res) => {
  try {
    setReadCache(res, 30);
    return res.json(await getSupplierSummaryService(req.query));
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to load supplier summary."
    );
  }
};

export const getSupplier = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await getSupplierService(req.params.id, {
        includeSensitive:
          req.query.includeSensitive !== undefined
            ? req.query.includeSensitive === "true" ||
              req.query.includeSensitive === "1"
            : true,
        includeStats:
          req.query.includeStats !== "false" &&
          req.query.includeStats !== "0",
      })
    );
  } catch (error) {
    return sendError(res, error, "Failed to load supplier.");
  }
};

export const lookupSupplier = async (req, res) => {
  try {
    setReadCache(res, 30);
    return res.json(
      await lookupSupplierService(req.params.value)
    );
  } catch (error) {
    return sendError(res, error, "Failed to find supplier.");
  }
};

export const createSupplier = async (req, res) => {
  try {
    setNoStore(res);

    const result = await createSupplierService({
      tenantId: req.tenantId,
      body: req.body,
      actorId: actorId(req),
      meta: requestMeta(req),
    });

    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error, "Failed to create supplier.");
  }
};

export const updateSupplier = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await updateSupplierService({
        id: req.params.id,
        body: req.body,
        actorId: actorId(req),
        meta: requestMeta(req),
      })
    );
  } catch (error) {
    return sendError(res, error, "Failed to update supplier.");
  }
};

export const submitSupplier = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await submitSupplierService({
        id: req.params.id,
        actorId: actorId(req),
        meta: requestMeta(req),
      })
    );
  } catch (error) {
    return sendError(res, error, "Failed to submit supplier.");
  }
};

export const approveSupplier = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await approveSupplierService({
        id: req.params.id,
        actorId: actorId(req),
        meta: requestMeta(req),
      })
    );
  } catch (error) {
    return sendError(res, error, "Failed to approve supplier.");
  }
};

export const rejectSupplier = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await rejectSupplierService({
        id: req.params.id,
        reason: req.body.reason,
        actorId: actorId(req),
        meta: requestMeta(req),
      })
    );
  } catch (error) {
    return sendError(res, error, "Failed to reject supplier.");
  }
};

export const updateSupplierStatus = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await updateSupplierStatusService({
        id: req.params.id,
        status: req.body.status,
        reason: req.body.reason,
        actorId: actorId(req),
        meta: requestMeta(req),
      })
    );
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to update supplier status."
    );
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await archiveSupplierService({
        id: req.params.id,
        actorId: actorId(req),
        meta: requestMeta(req),
      })
    );
  } catch (error) {
    return sendError(res, error, "Failed to archive supplier.");
  }
};

export const restoreSupplier = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await restoreSupplierService({
        id: req.params.id,
        actorId: actorId(req),
        meta: requestMeta(req),
      })
    );
  } catch (error) {
    return sendError(res, error, "Failed to restore supplier.");
  }
};

export const listSupplierProducts = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await listSupplierProductsService({
        supplierId: req.params.id,
        query: req.query,
      })
    );
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to load supplier products."
    );
  }
};

export const getSupplierProduct = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await getSupplierProductService({
        supplierId: req.params.id,
        linkId: req.params.linkId,
      })
    );
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to load supplier-product link."
    );
  }
};

export const createSupplierProduct = async (req, res) => {
  try {
    setNoStore(res);

    const result = await createSupplierProductService({
      supplierId: req.params.id,
      body: req.body,
      actorId: actorId(req),
      meta: requestMeta(req),
    });

    return res.status(201).json(result);
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to create supplier-product link."
    );
  }
};

export const updateSupplierProduct = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await updateSupplierProductService({
        supplierId: req.params.id,
        linkId: req.params.linkId,
        body: req.body,
        actorId: actorId(req),
        meta: requestMeta(req),
      })
    );
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to update supplier-product link."
    );
  }
};

export const updateSupplierProductStatus = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await updateSupplierProductStatusService({
        supplierId: req.params.id,
        linkId: req.params.linkId,
        status: req.body.status,
        actorId: actorId(req),
        meta: requestMeta(req),
      })
    );
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to update supplier-product status."
    );
  }
};

export const deleteSupplierProduct = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await archiveSupplierProductService({
        supplierId: req.params.id,
        linkId: req.params.linkId,
        actorId: actorId(req),
        meta: requestMeta(req),
      })
    );
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to archive supplier-product link."
    );
  }
};

export const restoreSupplierProduct = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await restoreSupplierProductService({
        supplierId: req.params.id,
        linkId: req.params.linkId,
        actorId: actorId(req),
        meta: requestMeta(req),
      })
    );
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to restore supplier-product link."
    );
  }
};

export const listSupplierAudits = async (req, res) => {
  try {
    setNoStore(res);

    return res.json(
      await listSupplierAuditsService({
        supplierId: req.params.id,
        query: req.query,
      })
    );
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to load supplier audit history."
    );
  }
};
