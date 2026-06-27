// ===============================
// ✅ models/user.model.js (FULL UPDATED)
// ✅ Employee profile fields added
// ✅ Job type + salary type + contact/address fields
// ===============================
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: "" },
    line2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "Bangladesh" },
    fullAddress: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    relation: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

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

    /**
     * Keep marketing_team temporarily for old data/backward compatibility.
     * New users should normally be:
     * role: employee + department + position + permissionGroup
     */
    role: {
      type: String,
      enum: ["superadmin", "admin", "employee", "marketing_team"],
      default: "employee",
      required: true,
      index: true,
    },

    // ===============================
    // ✅ Employee identity/contact fields
    // ===============================
    employeeId: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
      index: true,
      default: undefined,
    },

    phone: { type: String, trim: true, default: "", index: true },
    alternatePhone: { type: String, trim: true, default: "" },

    gender: {
      type: String,
      enum: ["", "male", "female", "other"],
      default: "",
      index: true,
    },

    dateOfBirth: { type: Date, default: null },
    address: { type: addressSchema, default: () => ({}) },
    emergencyContact: { type: emergencyContactSchema, default: () => ({}) },

    // ===============================
    // ✅ Company job fields
    // ===============================
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },

    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
      default: null,
      index: true,
    },

    permissionGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PermissionGroup",
      default: null,
      index: true,
    },

    accessRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccessRole",
      default: null,
      index: true,
    },

    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    joiningDate: { type: Date, default: null, index: true },
    leavingDate: { type: Date, default: null },

    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "intern", "contract"],
      default: "full_time",
      index: true,
    },

    /**
     * This is the employee's salary mode for quick filtering/display.
     * Actual salary amount/rules stay in SalaryProfile.
     */
    salaryType: {
      type: String,
      enum: ["fixed", "hourly", "commission"],
      default: "fixed",
      index: true,
    },

    employeeStatus: {
      type: String,
      enum: ["active", "probation", "on_leave", "resigned", "terminated"],
      default: "active",
      index: true,
    },

    isActive: { type: Boolean, default: true, index: true },

    avatarUrl: { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },

    // ===============================
    // ✅ CRM Work Queue / Assignment Fields
    // ===============================
    dailyLeadLimit: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    teamRole: {
      type: String,
      enum: ["", "admin", "manager", "sales", "marketing", "support"],
      default: "",
      index: true,
    },

    isAvailableForAssignment: {
      type: Boolean,
      default: true,
      index: true,
    },

    lastAssignedLeadAt: {
      type: Date,
      default: null,
      index: true,
    },

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

    workStatus: {
      type: String,
      enum: ["available", "busy", "offline", "on_leave"],
      default: "available",
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
userSchema.index({ role: 1, isActive: 1, nameLower: 1, _id: -1 });
userSchema.index({ department: 1, position: 1, isActive: 1 });
userSchema.index({ employmentType: 1, salaryType: 1, isActive: 1 });
userSchema.index({ employeeStatus: 1, isActive: 1 });

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
   ✅ Normalize fields
================================ */
userSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.name = String(this.name || "").trim();
    this.nameLower = this.name.toLowerCase();
  }

  if (this.isModified("email")) {
    this.email = String(this.email || "").trim().toLowerCase();
  }

  if (this.isModified("employeeId") && this.employeeId) {
    this.employeeId = String(this.employeeId || "").trim().toUpperCase();
  }

  if (this.isModified("phone")) this.phone = String(this.phone || "").trim();
  if (this.isModified("alternatePhone")) {
    this.alternatePhone = String(this.alternatePhone || "").trim();
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
    const name = String(nextName || "").trim();

    update.$set = {
      ...(update.$set || {}),
      name,
      nameLower: name.toLowerCase(),
    };

    if (update.name !== undefined) delete update.name;
  }

  const nextEmail = $set.email ?? update.email;

  if (nextEmail !== undefined) {
    update.$set = {
      ...(update.$set || {}),
      email: String(nextEmail || "").trim().toLowerCase(),
    };

    if (update.email !== undefined) delete update.email;
  }

  const nextEmployeeId = $set.employeeId ?? update.employeeId;

  if (nextEmployeeId !== undefined) {
    const employeeId = String(nextEmployeeId || "").trim().toUpperCase();

    update.$set = {
      ...(update.$set || {}),
      employeeId: employeeId || undefined,
    };

    if (update.employeeId !== undefined) delete update.employeeId;
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
  return (
    this.role === "marketing_team" ||
    this.teamRole === "marketing" ||
    this.permissionGroup?.permissions?.includes?.("leads:view")
  );
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
