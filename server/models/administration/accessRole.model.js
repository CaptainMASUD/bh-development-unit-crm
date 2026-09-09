import mongoose from "mongoose";

const accessRoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, trim: true, default: "", index: true },
    description: { type: String, trim: true, default: "" },
    permissionGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PermissionGroup",
      required: true,
      index: true,
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

accessRoleSchema.index({ tenantId: 1, nameLower: 1 }, { unique: true });

accessRoleSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.name = String(this.name || "").trim();
    this.nameLower = this.name.toLowerCase();
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
