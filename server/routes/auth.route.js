import express from "express";
import { login, register } from "../controllers/auth.controller.js";
import { protect, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/login", login);

router.post("/register", register);

export default router;
