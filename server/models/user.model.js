// ===============================
// ✅ models/user.model.js (FULL UPDATED)
// ===============================
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // ✅ For optimized prefix search (autocomplete)
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
  },
  { timestamps: true }
);

/* ✅ Performance indexes */
userSchema.index({ role: 1, createdAt: -1, _id: -1 });
userSchema.index({ role: 1, isActive: 1, createdAt: -1, _id: -1 });

/* ✅ Fast autocomplete index */
userSchema.index({ role: 1, isActive: 1, nameLower: 1, _id: -1 });

/* 🔐 Protect superadmin role */
userSchema.post("init", function () {
  this._originalRole = this.role;
});

userSchema.pre("save", function (next) {
  if (this.isModified("role") && this._originalRole === "superadmin") {
    return next(new Error("Super admin role cannot be changed"));
  }
  next();
});

/* ✅ Normalize nameLower */
userSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.nameLower = String(this.name || "").trim().toLowerCase();
  }
  next();
});

/* ✅ Normalize nameLower on findOneAndUpdate */
userSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || {};

  const nextName = $set.name ?? update.name;
  if (nextName !== undefined) {
    const nl = String(nextName || "").trim().toLowerCase();
    update.$set = { ...(update.$set || {}), nameLower: nl };
    delete update.name;
    this.setUpdate(update);
  }

  next();
});

/* 🔐 Hash password */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* Helpers */
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.isAdmin = function () {
  return this.role === "admin" || this.role === "superadmin";
};

userSchema.methods.isMarketing = function () {
  return this.role === "marketing_team";
};

export default mongoose.model("User", userSchema);
