import mongoose from "mongoose";

export const PERMISSION_KEYS = [
  "dashboard:view",
  "customers:view",
  "customers:manage",
  "leads:view",
  "leads:manage",
  "deals:view",
  "deals:manage",
  "finance:view",
  "finance:manage",
  "tasks:view",
  "tasks:manage",
  "reports:view",
  "attendance:view",
  "attendance:manage",
  "payroll:view",
  "payroll:manage",
  "tax.view",
  "tax.create",
  "tax.update",
  "tax.delete",
  "tax.assign_employee",
  "tax.report",
  "expenses:view",
  "expenses:manage",
  "expense-setup:view",
  "expense-setup:manage",
  "bank-setup:view",
  "bank-setup:manage",
  "loans:view",
  "loans:manage",
  "leaves:view",
  "leaves:manage",
  "roster:view",
  "roster:manage",
  "employees:view",
  "employees:manage",
  "salary:view",
  "salary:manage",
  "notifications:view",
  "notifications:manage",
  "access-control:view",
  "access-control:manage",
  "workflow:view",
  "profile:view",
  "inventory-product:view",
  "inventory-product:manage",
  "inventory-product:delete",
  "inventory-category:view",
  "inventory-category:manage",
  "inventory-category:delete",
  "inventory-brand:view",
  "inventory-brand:manage",
  "inventory-brand:delete",
  "inventory-unit:view",
  "inventory-unit:manage",
  "inventory-unit:delete",
  "inventory-warehouse:view",
  "inventory-warehouse:manage",
  "inventory-warehouse:delete",
  "inventory-location:view",
  "inventory-location:manage",
  "inventory-location:delete",
  "inventory-stock:view",
  "inventory-stock:manage",
  "inventory-stock:delete",
  "inventory-movement:view",
  "inventory-movement:manage",
  "inventory-movement:post",
  "inventory-movement:reverse",
  "inventory-movement:delete",
  "inventory-adjustment:view",
  "inventory-adjustment:manage",
  "inventory-adjustment:approve",
  "inventory-adjustment:post",
  "inventory-adjustment:reverse",
  "inventory-adjustment:delete",
  "inventory-transfer:view",
  "inventory-transfer:manage",
  "inventory-transfer:approve",
  "inventory-transfer:dispatch",
  "inventory-transfer:receive",
  "inventory-transfer:reverse",
  "inventory-transfer:delete",
  "inventory-report:view",
  "supplier:view",
  "supplier:manage",
  "supplier:approve",
  "supplier:delete",
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
