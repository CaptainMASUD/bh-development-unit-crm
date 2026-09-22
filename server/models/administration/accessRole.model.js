import mongoose from "mongoose";

const accessMatrixRowSchema = new mongoose.Schema(
  {
    submodule: { type: String, required: true, trim: true },
    view: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    approve: { type: Boolean, default: false },
  },
  { _id: false }
);

const accessRoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, trim: true, default: "", index: true },
    description: { type: String, trim: true, default: "" },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },

    modules: {
      type: [String],
      default: [],
    },

    accessMatrix: {
      type: [accessMatrixRowSchema],
      default: [],
    },

    permissions: {
      type: [String],
      default: [],
    },

    permissionGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PermissionGroup",
      default: null,
      index: true,
    },

    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

accessRoleSchema.index({ tenantId: 1, nameLower: 1 }, { unique: true });

accessRoleSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.name = String(this.name || "").trim();
    this.nameLower = this.name.toLowerCase();
  }
  if (this.isModified("modules")) {
    this.modules = [...new Set((this.modules || []).map((m) => String(m).trim().toLowerCase()).filter(Boolean))];
  }
  if (this.isModified("permissions")) {
    this.permissions = [...new Set((this.permissions || []).map((p) => String(p).trim()).filter(Boolean))];
  }
  next();
});

accessRoleSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const nextName = update.$set?.name ?? update.name;
  if (nextName !== undefined) {
    const name = String(nextName || "").trim();
    update.$set = { ...(update.$set || {}), name, nameLower: name.toLowerCase() };
    if (update.name !== undefined) delete update.name;
  }
  this.setUpdate(update);
  next();
});

export default mongoose.model("AccessRole", accessRoleSchema);
