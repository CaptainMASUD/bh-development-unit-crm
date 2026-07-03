// routes/user.route.js

import express from "express";
import { login, register } from "../controllers/auth.controller.js";
import upload from "../middleware/multer.js";

import {
  getMe,
  updateMe,

  // avatar
  updateMyAvatar,
  deleteMyAvatar,
  adminUpdateUserAvatar,
  adminDeleteUserAvatar,

  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,

  createAdmin,
  getAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,

  createSuperAdmin,
  getSuperAdmins,
  getSuperAdminById,
  updateSuperAdmin,
  deleteSuperAdmin,

} from "../controllers/user.controller.js";

import {
  protect,
  isAdminOrSuperAdmin,
  requirePermission,
  isSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* AUTH */
router.post("/login", login);
router.post("/register", register);

/* ME */
router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);

/* ✅ ME AVATAR */
router.patch("/me/avatar", protect, upload.single("avatar"), updateMyAvatar);
router.delete("/me/avatar", protect, deleteMyAvatar);

/* ✅ ADMIN AVATAR CRUD */
router.patch(
  "/:id/avatar",
  protect,
  requirePermission("employees:manage"),
  upload.single("avatar"),
  adminUpdateUserAvatar
);
router.delete(
  "/:id/avatar",
  protect,
  requirePermission("employees:manage"),
  adminDeleteUserAvatar
);

/* EMPLOYEES */
router.post("/employees", protect, requirePermission("employees:manage"), createEmployee);
router.get("/employees", protect, requirePermission("employees:view"), getEmployees);
router.get("/employees/:id", protect, requirePermission("employees:view"), getEmployeeById);
router.patch("/employees/:id", protect, requirePermission("employees:manage"), updateEmployee);
router.delete("/employees/:id", protect, requirePermission("employees:manage"), deleteEmployee);

/* ADMINS */
router.post("/admins", protect, isAdminOrSuperAdmin, createAdmin);
router.get("/admins", protect, isAdminOrSuperAdmin, getAdmins);
router.get("/admins/:id", protect, isAdminOrSuperAdmin, getAdminById);
router.patch("/admins/:id", protect, isAdminOrSuperAdmin, updateAdmin);
router.delete("/admins/:id", protect, isAdminOrSuperAdmin, deleteAdmin);

/* SUPER ADMINS */
router.post("/superadmins", protect, isSuperAdmin, createSuperAdmin);
router.get("/superadmins", protect, isSuperAdmin, getSuperAdmins);
router.get("/superadmins/:id", protect, isSuperAdmin, getSuperAdminById);
router.patch("/superadmins/:id", protect, isSuperAdmin, updateSuperAdmin);
router.delete("/superadmins/:id", protect, isSuperAdmin, deleteSuperAdmin);

export default router;
