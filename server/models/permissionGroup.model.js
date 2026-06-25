import mongoose from "mongoose";

export const PERMISSION_KEYS = [
  "dashboard:view",
  "customers:view",
  "customers:manage",
  "leads:view",
  "leads:manage",
  "deals:view",
  "deals:manage",
  "reports:view",
  "workflow:view",
  "profile:view",
];

const permissionGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    nameLower: { type: String, trim: true, default: "", index: true },
    description: { type: String, trim: true, default: "" },
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator(values) {
          return values.every((value) => PERMISSION_KEYS.includes(value));
        },
        message: "Unknown permission key.",
      },
    },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

permissionGroupSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.name = String(this.name || "").trim();
    this.nameLower = this.name.toLowerCase();
  }
  if (this.isModified("permissions")) {
    this.permissions = [...new Set(this.permissions || [])];
  }
  next();
});

permissionGroupSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const nextName = update.$set?.name ?? update.name;
  const nextPermissions = update.$set?.permissions ?? update.permissions;

  if (nextName !== undefined) {
    const name = String(nextName || "").trim();
    update.$set = {
      ...(update.$set || {}),
      name,
      nameLower: name.toLowerCase(),
    };
    if (update.name !== undefined) delete update.name;
  }

  if (nextPermissions !== undefined) {
    update.$set = {
      ...(update.$set || {}),
      permissions: [...new Set(nextPermissions || [])],
    };
    if (update.permissions !== undefined) delete update.permissions;
  }

  this.setUpdate(update);
  next();
});

export default mongoose.model("PermissionGroup", permissionGroupSchema);
