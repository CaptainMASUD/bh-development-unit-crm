import mongoose from "mongoose";

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const defaultSalaryComponentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, trim: true, default: "", index: true },

    type: {
      type: String,
      enum: ["earning", "deduction"],
      required: true,
      index: true,
    },

    calculationType: {
      type: String,
      enum: ["fixed", "percentage", "per_day", "per_hour", "per_minute", "variable"],
      default: "fixed",
      required: true,
    },

    value: {
      type: Number,
      default: 0,
      min: 0,
      set: roundMoney,
    },

    basedOn: {
      type: String,
      enum: ["basicSalary", "grossSalary", "netSalary", "manual"],
      default: "basicSalary",
    },

    isRecurring: { type: Boolean, default: true },
    isTaxable: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    note: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

defaultSalaryComponentSchema.pre("validate", function (next) {
  this.name = String(this.name || "").trim();
  this.nameLower = this.name.toLowerCase();
  this.value = roundMoney(this.value);
  next();
});

const defaultPayrollRulesSchema = new mongoose.Schema(
  {
    overtime: {
      enabled: { type: Boolean, default: false },
      calculationType: {
        type: String,
        enum: ["fixed", "per_hour", "percentage"],
        default: "per_hour",
      },
      value: { type: Number, default: 0, min: 0, set: roundMoney },
      basedOn: {
        type: String,
        enum: ["basicSalary", "grossSalary", "manual"],
        default: "basicSalary",
      },
    },

    lateDeduction: {
      enabled: { type: Boolean, default: false },
      graceMinutes: { type: Number, default: 0, min: 0 },
      calculationType: {
        type: String,
        enum: ["fixed", "per_minute", "percentage"],
        default: "fixed",
      },
      value: { type: Number, default: 0, min: 0, set: roundMoney },
      basedOn: {
        type: String,
        enum: ["basicSalary", "grossSalary", "manual"],
        default: "basicSalary",
      },
    },

    absentDeduction: {
      enabled: { type: Boolean, default: true },
      calculationType: {
        type: String,
        enum: ["per_day", "fixed", "percentage"],
        default: "per_day",
      },
      value: { type: Number, default: 0, min: 0, set: roundMoney },
      basedOn: {
        type: String,
        enum: ["basicSalary", "grossSalary", "manual"],
        default: "basicSalary",
      },
    },

    unpaidLeaveDeduction: {
      enabled: { type: Boolean, default: true },
      calculationType: {
        type: String,
        enum: ["per_day", "fixed", "percentage"],
        default: "per_day",
      },
      value: { type: Number, default: 0, min: 0, set: roundMoney },
      basedOn: {
        type: String,
        enum: ["basicSalary", "grossSalary", "manual"],
        default: "basicSalary",
      },
    },

    weeklyHolidayPaid: { type: Boolean, default: true },
    paidLeaveAllowed: { type: Boolean, default: true },
  },
  { _id: false }
);

const positionSchema = new mongoose.Schema(
  {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true },
    titleLower: { type: String, trim: true, default: "", index: true },

    description: { type: String, trim: true, default: "" },

    isActive: { type: Boolean, default: true, index: true },

    // ===============================
    // ✅ Optional default salary setup
    // ===============================
    defaultSalaryEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },

    defaultSalaryType: {
      type: String,
      enum: ["monthly", "daily", "hourly"],
      default: "monthly",
    },

    defaultCurrency: {
      type: String,
      default: "BDT",
      trim: true,
      uppercase: true,
    },

    defaultBasicSalary: {
      type: Number,
      default: 0,
      min: 0,
      set: roundMoney,
    },

    defaultWorkingDaysPerMonth: {
      type: Number,
      default: 26,
      min: 1,
      max: 31,
    },

    defaultWorkingHoursPerDay: {
      type: Number,
      default: 8,
      min: 1,
      max: 24,
    },

    defaultComponents: {
      type: [defaultSalaryComponentSchema],
      default: [],
    },

    defaultRules: {
      type: defaultPayrollRulesSchema,
      default: () => ({}),
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

positionSchema.index({ department: 1, titleLower: 1 }, { unique: true });
positionSchema.index({ department: 1, isActive: 1, titleLower: 1 });
positionSchema.index({ defaultSalaryEnabled: 1, defaultBasicSalary: 1 });

positionSchema.pre("validate", function (next) {
  if (this.isModified("title")) {
    this.title = String(this.title || "").trim();
    this.titleLower = this.title.toLowerCase();
  }

  this.defaultCurrency = String(this.defaultCurrency || "BDT").trim().toUpperCase();
  this.defaultBasicSalary = roundMoney(this.defaultBasicSalary);

  if (this.defaultBasicSalary > 0) {
    this.defaultSalaryEnabled = true;
  }

  next();
});

positionSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || {};

  const nextTitle = $set.title ?? update.title;
  if (nextTitle !== undefined) {
    const title = String(nextTitle || "").trim();

    update.$set = {
      ...(update.$set || {}),
      title,
      titleLower: title.toLowerCase(),
    };

    if (update.title !== undefined) delete update.title;
  }

  const nextCurrency = $set.defaultCurrency ?? update.defaultCurrency;
  if (nextCurrency !== undefined) {
    update.$set = {
      ...(update.$set || {}),
      defaultCurrency: String(nextCurrency || "BDT").trim().toUpperCase(),
    };

    if (update.defaultCurrency !== undefined) delete update.defaultCurrency;
  }

  const nextBasicSalary = $set.defaultBasicSalary ?? update.defaultBasicSalary;
  if (nextBasicSalary !== undefined) {
    const salary = roundMoney(nextBasicSalary);

    update.$set = {
      ...(update.$set || {}),
      defaultBasicSalary: salary,
    };

    if (salary > 0 && ($set.defaultSalaryEnabled === undefined && update.defaultSalaryEnabled === undefined)) {
      update.$set.defaultSalaryEnabled = true;
    }

    if (update.defaultBasicSalary !== undefined) delete update.defaultBasicSalary;
  }

  this.setUpdate(update);
  next();
});

export default mongoose.model("Position", positionSchema);