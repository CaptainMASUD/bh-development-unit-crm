import express from "express";
import { login, register, registerSuperAdmin } from "../../controllers/auth.controller.js";
import { protect, isAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/register-superadmin", registerSuperAdmin);
router.post("/superadmin/register", registerSuperAdmin);

export default router;
