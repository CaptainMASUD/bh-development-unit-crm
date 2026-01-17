// ===============================
// ✅ 5) routes/user.route.js  (UPDATED)
// ===============================
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

  createMarketingTeam,
  getMarketingTeam,
  getMarketingTeamById,
  updateMarketingTeam,
  deleteMarketingTeam,

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
  isAdminOrSuperAdmin,
  upload.single("avatar"),
  adminUpdateUserAvatar
);
router.delete(
  "/:id/avatar",
  protect,
  isAdminOrSuperAdmin,
  adminDeleteUserAvatar
);

/* EMPLOYEES */
router.post("/employees", protect, isAdminOrSuperAdmin, createEmployee);
router.get("/employees", protect, isAdminOrSuperAdmin, getEmployees);
router.get("/employees/:id", protect, isAdminOrSuperAdmin, getEmployeeById);
router.patch("/employees/:id", protect, isAdminOrSuperAdmin, updateEmployee);
router.delete("/employees/:id", protect, isAdminOrSuperAdmin, deleteEmployee);

/* MARKETING TEAM */
router.post("/marketing-team", protect, isAdminOrSuperAdmin, createMarketingTeam);
router.get("/marketing-team", protect, isAdminOrSuperAdmin, getMarketingTeam);
router.get("/marketing-team/:id", protect, isAdminOrSuperAdmin, getMarketingTeamById);
router.patch("/marketing-team/:id", protect, isAdminOrSuperAdmin, updateMarketingTeam);
router.delete("/marketing-team/:id", protect, isAdminOrSuperAdmin, deleteMarketingTeam);

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

