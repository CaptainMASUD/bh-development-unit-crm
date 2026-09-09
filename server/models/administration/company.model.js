import mongoose from "mongoose";
import { ERP_MODULE_IDS, normalizeModuleIds } from "../../config/erpModules.js";

const addressSchema = new mongoose.Schema({
  line1: { type: String, trim: true, default: "" },
  line2: { type: String, trim: true, default: "" },
  city: { type: String, trim: true, default: "" },
  state: { type: String, trim: true, default: "" },
  postalCode: { type: String, trim: true, default: "" },
  country: { type: String, trim: true, default: "Bangladesh" },
  latitude: { type: String, trim: true, default: "" },
  longitude: { type: String, trim: true, default: "" },
}, { _id: false });

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  legalName: { type: String, trim: true, default: "" },
  code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
  industry: { type: String, trim: true, default: "" },
  registrationNo: { type: String, trim: true, default: "" },
  taxId: { type: String, trim: true, default: "" },
  email: { type: String, trim: true, lowercase: true, default: "" },
  phone: { type: String, trim: true, default: "" },
  website: { type: String, trim: true, default: "" },
  logoUrl: { type: String, trim: true, default: "" },
  address: { type: addressSchema, default: () => ({}) },
  settings: {
    currency: { type: String, trim: true, uppercase: true, default: "BDT" },
    timezone: { type: String, trim: true, default: "Asia/Dhaka" },
    fiscalYearStart: { type: String, trim: true, default: "01-01" },
    dateFormat: { type: String, trim: true, default: "DD/MM/YYYY" },
  },
  subscription: {
    plan: { type: String, trim: true, default: "Professional" },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
  },
  enabledModules: { type: [String], enum: ERP_MODULE_IDS, default: () => normalizeModuleIds([]), set: (values) => normalizeModuleIds(values) },
  status: { type: String, enum: ["active", "trial", "pending", "suspended"], default: "active", index: true },
  note: { type: String, trim: true, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, tenantScoped: false });

companySchema.pre("save", function normalizeCompany(next) {
  this.name = String(this.name || "").trim();
  this.code = String(this.code || "").trim().toUpperCase();
  this.enabledModules = normalizeModuleIds(this.enabledModules);
  next();
});

export default mongoose.model("Company", companySchema);
