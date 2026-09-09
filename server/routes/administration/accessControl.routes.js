import express from "express";
import {
  createDepartment,
  createPermissionGroup,
  createPosition,
  deleteDepartment,
  deletePermissionGroup,
  deletePosition,
  getPermissionCatalog,
  listDepartments,
  listPermissionGroups,
  listPositions,
  updateDepartment,
  updatePermissionGroup,
  updatePosition,
  listAccessRoles,
  createAccessRole,
  updateAccessRole,
  deleteAccessRole,
} from "../../controllers/accessControl.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requirePermission("access-control:view"));

router.get("/permissions", getPermissionCatalog);

router.get("/departments", listDepartments);
router.post("/departments", requirePermission("access-control:manage"), createDepartment);
router.patch("/departments/:id", requirePermission("access-control:manage"), updateDepartment);
router.delete("/departments/:id", requirePermission("access-control:manage"), deleteDepartment);

router.get("/positions", listPositions);
router.post("/positions", requirePermission("access-control:manage"), createPosition);
router.patch("/positions/:id", requirePermission("access-control:manage"), updatePosition);
router.delete("/positions/:id", requirePermission("access-control:manage"), deletePosition);

router.get("/permission-groups", listPermissionGroups);
router.post("/permission-groups", requirePermission("access-control:manage"), createPermissionGroup);
router.patch("/permission-groups/:id", requirePermission("access-control:manage"), updatePermissionGroup);
router.delete("/permission-groups/:id", requirePermission("access-control:manage"), deletePermissionGroup);

router.get("/roles", listAccessRoles);
router.post("/roles", requirePermission("access-control:manage"), createAccessRole);
router.patch("/roles/:id", requirePermission("access-control:manage"), updateAccessRole);
router.delete("/roles/:id", requirePermission("access-control:manage"), deleteAccessRole);

export default router;
