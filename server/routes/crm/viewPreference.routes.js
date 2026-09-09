// routes/viewPreference.routes.js
import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { getViewPreference, upsertViewPreference } from "../../controllers/viewPreference.controller.js";

const router = express.Router();

router.use(protect);

// GET current preference (or default if none saved)
router.get("/:key", getViewPreference);

// PUT save/update preference
router.put("/:key", upsertViewPreference);

export default router;
