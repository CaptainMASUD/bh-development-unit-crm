import mongoose from "mongoose";

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const salaryComponentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    nameLower: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

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

    /**
     * For fixed: amount
     * For percentage: percentage value
     * For per_day/per_hour/per_minute: rate value
     * For variable: default 0, monthly payroll can override
     */
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

    isRecurring: {
      type: Boolean,
      default: true,
      index: true,
    },

    isTaxable: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: true }
);

salaryComponentSchema.pre("validate", function (next) {
  this.name = String(this.name || "").trim();
  this.nameLower = this.name.toLowerCase();
  this.value = roundMoney(this.value);
  next();
});

const payrollRulesSchema = new mongoose.Schema(
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

    weeklyHolidayPaid: {
      type: Boolean,
      default: true,
    },

    paidLeaveAllowed: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const salaryProfileSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

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

    salaryType: {
      type: String,
      enum: ["monthly", "daily", "hourly"],
      default: "monthly",
      index: true,
    },

    currency: {
      type: String,
      default: "BDT",
      trim: true,
      uppercase: true,
    },

    basicSalary: {
      type: Number,
      required: true,
      min: 0,
      set: roundMoney,
    },

    workingDaysPerMonth: {
      type: Number,
      default: 26,
      min: 1,
      max: 31,
    },

    workingHoursPerDay: {
      type: Number,
      default: 8,
      min: 1,
      max: 24,
    },

    components: {
      type: [salaryComponentSchema],
      default: [],
    },

    rules: {
      type: payrollRulesSchema,
      default: () => ({}),
    },

    effectiveFrom: {
      type: Date,
      required: true,
      index: true,
    },

    effectiveTo: {
      type: Date,
      default: null,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

/* ===============================
   Indexes
================================ */
salaryProfileSchema.index({ employee: 1, isActive: 1, effectiveFrom: -1 });
salaryProfileSchema.index({ department: 1, isActive: 1 });
salaryProfileSchema.index({ position: 1, isActive: 1 });
salaryProfileSchema.index({ createdAt: -1, _id: -1 });

/**
 * Only one active salary profile per employee.
 */
salaryProfileSchema.index(
  { employee: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

/* ===============================
   Validation
================================ */
salaryProfileSchema.pre("validate", function (next) {
  this.currency = String(this.currency || "BDT").trim().toUpperCase();
  this.basicSalary = roundMoney(this.basicSalary);

  if (this.effectiveTo && this.effectiveFrom && this.effectiveTo < this.effectiveFrom) {
    return next(new Error("effectiveTo cannot be before effectiveFrom."));
  }

  next();
});

/* ===============================
   Helpers
================================ */
salaryProfileSchema.methods.getActiveComponents = function (type) {
  return (this.components || []).filter(
    (item) => item.isActive && (!type || item.type === type)
  );
};

salaryProfileSchema.methods.getFixedMonthlyPreview = function () {
  const activeComponents = this.getActiveComponents();

  const earnings = activeComponents.filter((item) => item.type === "earning");
  const deductions = activeComponents.filter((item) => item.type === "deduction");

  const fixedEarnings = earnings.reduce((sum, item) => {
    if (item.calculationType === "fixed") return sum + Number(item.value || 0);
    return sum;
  }, 0);

  const fixedDeductions = deductions.reduce((sum, item) => {
    if (item.calculationType === "fixed") return sum + Number(item.value || 0);
    if (item.calculationType === "percentage") {
      const base = item.basedOn === "grossSalary"
        ? Number(this.basicSalary || 0) + fixedEarnings
        : Number(this.basicSalary || 0);

      return sum + (base * Number(item.value || 0)) / 100;
    }
    return sum;
  }, 0);

  const grossSalary = roundMoney(Number(this.basicSalary || 0) + fixedEarnings);
  const totalDeduction = roundMoney(fixedDeductions);
  const netSalary = roundMoney(grossSalary - totalDeduction);

  return {
    basicSalary: roundMoney(this.basicSalary),
    fixedEarnings: roundMoney(fixedEarnings),
    grossSalary,
    fixedDeductions: totalDeduction,
    netSalary,
  };
};

export default mongoose.model("SalaryProfile", salaryProfileSchema);