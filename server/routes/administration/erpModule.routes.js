import express from "express";
import { listModules } from "../../controllers/company.controller.js";
import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.get("/", protect, listModules);
export default router;
