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
} from "../controllers/accessControl.controller.js";
import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, isAdminOrSuperAdmin);

router.get("/permissions", getPermissionCatalog);

router.get("/departments", listDepartments);
router.post("/departments", createDepartment);
router.patch("/departments/:id", updateDepartment);
router.delete("/departments/:id", deleteDepartment);

router.get("/positions", listPositions);
router.post("/positions", createPosition);
router.patch("/positions/:id", updatePosition);
router.delete("/positions/:id", deletePosition);

router.get("/permission-groups", listPermissionGroups);
router.post("/permission-groups", createPermissionGroup);
router.patch("/permission-groups/:id", updatePermissionGroup);
router.delete("/permission-groups/:id", deletePermissionGroup);

export default router;
