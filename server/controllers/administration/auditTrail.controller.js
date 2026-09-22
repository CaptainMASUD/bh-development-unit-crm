import {
  getAuditTrailDetail as fetchAuditTrailDetail,
  getAuditTrailFilterOptions,
  listAuditTrail,
} from "../../services/administration/auditTrail.service.js";

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const getAuditTrail = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 25,
    module: mod,
    action,
    actorId,
    entityType,
    startDate,
    endDate,
    search,
  } = req.query;

  const result = await listAuditTrail({
    tenantId: req.tenantId,
    page,
    limit,
    module: mod,
    action,
    actorId,
    entityType,
    startDate,
    endDate,
    search,
  });

  return res.json({
    success: true,
    data: result,
  });
});

export const getAuditTrailFilters = asyncHandler(async (req, res) => {
  const filters = await getAuditTrailFilterOptions({
    tenantId: req.tenantId,
  });

  return res.json({
    success: true,
    data: filters,
  });
});

export const getAuditTrailDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const log = await fetchAuditTrailDetail({
    tenantId: req.tenantId,
    id,
  });

  return res.json({
    success: true,
    data: { log },
  });
});
