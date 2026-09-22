import {
  createRole,
  deleteRole,
  getRoleDetail,
  getRoleMatrixCatalog,
  listRoles,
  updateRole,
} from "../../services/administration/roleManagement.service.js";
import { getReqMeta } from "../../utils/audit.js";

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const getRoles = asyncHandler(async (req, res) => {
  const { search, department, module: mod } = req.query;
  const result = await listRoles({
    tenantId: req.tenantId,
    search,
    departmentId: department,
    moduleId: mod,
  });

  return res.json({
    success: true,
    data: result,
  });
});

export const getRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const role = await getRoleDetail({
    tenantId: req.tenantId,
    id,
  });

  return res.json({
    success: true,
    data: { role },
  });
});

export const postRole = asyncHandler(async (req, res) => {
  const role = await createRole({
    tenantId: req.tenantId,
    actorId: req.user?._id,
    input: req.body,
    reqMeta: getReqMeta(req),
  });

  return res.status(201).json({
    success: true,
    message: "Role created successfully.",
    data: { role },
  });
});

export const patchRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const role = await updateRole({
    tenantId: req.tenantId,
    actorId: req.user?._id,
    id,
    input: req.body,
    reqMeta: getReqMeta(req),
  });

  return res.json({
    success: true,
    message: "Role updated successfully.",
    data: { role },
  });
});

export const removeRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  const result = await deleteRole({
    tenantId: req.tenantId,
    actorId: req.user?._id,
    id,
    password,
    reqMeta: getReqMeta(req),
  });

  return res.json({
    success: true,
    ...result,
  });
});

export const getMatrixCatalog = asyncHandler(async (req, res) => {
  const catalog = getRoleMatrixCatalog();
  return res.json({
    success: true,
    data: { catalog },
  });
});
