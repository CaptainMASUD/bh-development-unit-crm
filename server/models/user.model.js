// ===============================
// ✅ models/user.model.js (FULL UPDATED)
// ===============================
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // ✅ For optimized prefix search/autocomplete
    nameLower: { type: String, trim: true, default: "", index: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: ["superadmin", "admin", "employee", "marketing_team"],
      default: "employee",
      required: true,
      index: true,
    },

    isActive: { type: Boolean, default: true, index: true },

    avatarUrl: { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },

    // ===============================
    // ✅ CRM Work Queue / Assignment Fields
    // ===============================

    /**
     * Maximum leads this user should receive per day.
     * 0 means unlimited.
     */
    dailyLeadLimit: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    /**
     * Internal team role for CRM workflow.
     * This is different from auth role.
     */
    teamRole: {
      type: String,
      enum: ["", "admin", "manager", "sales", "marketing", "support"],
      default: "",
      index: true,
    },

    /**
     * If false, auto-assignment will skip this user.
     */
    isAvailableForAssignment: {
      type: Boolean,
      default: true,
      index: true,
    },

    /**
     * Used for round-robin / least-loaded assignment tracking.
     */
    lastAssignedLeadAt: {
      type: Date,
      default: null,
      index: true,
    },

    /**
     * Optional workload tracking.
     * This can be updated by controller/automation later.
     */
    currentOpenLeadCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    currentPendingWorkQueueCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    /**
     * User availability status for CRM operation.
     */
    workStatus: {
      type: String,
      enum: ["available", "busy", "offline", "on_leave"],
      default: "available",
      index: true,
    },

    /**
     * Optional manager/team ownership.
     */
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

/* ===============================
   ✅ Performance indexes
================================ */
userSchema.index({ role: 1, createdAt: -1, _id: -1 });
userSchema.index({ role: 1, isActive: 1, createdAt: -1, _id: -1 });

/* ✅ Fast autocomplete index */
userSchema.index({ role: 1, isActive: 1, nameLower: 1, _id: -1 });

/* ✅ CRM assignment indexes */
userSchema.index({
  role: 1,
  isActive: 1,
  isAvailableForAssignment: 1,
  workStatus: 1,
  currentOpenLeadCount: 1,
});

userSchema.index({
  teamRole: 1,
  isActive: 1,
  isAvailableForAssignment: 1,
  lastAssignedLeadAt: 1,
});

userSchema.index({
  managerId: 1,
  role: 1,
  isActive: 1,
});

/* ===============================
   🔐 Protect superadmin role
================================ */
userSchema.post("init", function () {
  this._originalRole = this.role;
});

userSchema.pre("save", function (next) {
  if (this.isModified("role") && this._originalRole === "superadmin") {
    return next(new Error("Super admin role cannot be changed"));
  }

  next();
});

/* ===============================
   ✅ Normalize nameLower
================================ */
userSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.nameLower = String(this.name || "").trim().toLowerCase();
  }

  next();
});

/* ===============================
   ✅ Normalize fields on findOneAndUpdate
================================ */
userSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || {};

  const nextName = $set.name ?? update.name;

  if (nextName !== undefined) {
    const nl = String(nextName || "").trim().toLowerCase();

    update.$set = {
      ...(update.$set || {}),
      name: String(nextName || "").trim(),
      nameLower: nl,
    };

    if (update.name !== undefined) delete update.name;
  }

  if ($set.email !== undefined || update.email !== undefined) {
    const nextEmail = $set.email ?? update.email;

    update.$set = {
      ...(update.$set || {}),
      email: String(nextEmail || "").trim().toLowerCase(),
    };

    if (update.email !== undefined) delete update.email;
  }

  this.setUpdate(update);
  next();
});

/* ===============================
   🔐 Hash password
================================ */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

/* ===============================
   Helpers
================================ */
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.isAdmin = function () {
  return this.role === "admin" || this.role === "superadmin";
};

userSchema.methods.isSuperAdmin = function () {
  return this.role === "superadmin";
};

userSchema.methods.isEmployee = function () {
  return this.role === "employee";
};

userSchema.methods.isMarketing = function () {
  return this.role === "marketing_team";
};

userSchema.methods.canReceiveAutoAssignedLead = function () {
  return (
    this.isActive === true &&
    this.isAvailableForAssignment === true &&
    this.workStatus === "available" &&
    ["employee", "marketing_team"].includes(this.role)
  );
};

export default mongoose.model("User", userSchema);