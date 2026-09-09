// routes/customerViewPreference.routes.js
import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import {
  getCustomerViewPreference,
  upsertCustomerViewPreference,
} from "../../controllers/customerViewPreference.controller.js";

const router = express.Router();

router.use(protect);

// GET current preference (or default if none saved)
router.get("/:key", getCustomerViewPreference);

// PUT save/update preference
router.put("/:key", upsertCustomerViewPreference);

export default router;
