// routes/upload.route.js
import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { presignUpload } from "../../controllers/upload.controller.js";

const router = express.Router();
router.post("/presign", protect, presignUpload);

export default router;
