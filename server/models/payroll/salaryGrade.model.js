import mongoose from "mongoose";

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const salaryGradeComponentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["earning", "deduction"],
      required: true,
    },

    calculationType: {
      type: String,
      enum: ["fixed", "percentage", "per_day", "per_hour", "per_minute", "variable"],
      default: "percentage",
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

    isRecurring: {
      type: Boolean,
      default: true,
    },

    isTaxable: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: true }
);

const salaryGradeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    currency: {
      type: String,
      default: "BDT",
      trim: true,
      uppercase: true,
    },

    minBasicSalary: {
      type: Number,
      default: 0,
      min: 0,
      set: roundMoney,
    },

    maxBasicSalary: {
      type: Number,
      default: 0,
      min: 0,
      set: roundMoney,
    },

    defaultBasicSalary: {
      type: Number,
      default: 0,
      min: 0,
      set: roundMoney,
    },

    components: {
      type: [salaryGradeComponentSchema],
      default: [],
    },

    rules: {
      type: Object,
      default: () => ({}),
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

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

salaryGradeSchema.index({ code: 1 }, { unique: true });
salaryGradeSchema.index({ isActive: 1, name: 1 });

export default mongoose.model("SalaryGrade", salaryGradeSchema);
