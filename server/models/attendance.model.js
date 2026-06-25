import mongoose from "mongoose";

const round2 = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const normalizeDateOnly = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const getDayKey = (date) => {
  const d = normalizeDateOnly(date);
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const attendanceSchema = new mongoose.Schema(
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

    workDate: {
      type: Date,
      required: true,
      index: true,
    },

    dayKey: {
      type: String,
      required: true,
      index: true,
    },

    year: {
      type: Number,
      required: true,
      index: true,
    },

    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "present",
        "absent",
        "late",
        "half_day",
        "paid_leave",
        "unpaid_leave",
        "weekly_holiday",
        "holiday",
      ],
      required: true,
      default: "present",
      index: true,
    },

    source: {
      type: String,
      enum: ["manual", "web", "app", "biometric", "card_punch", "deep_learning"],
      default: "manual",
      index: true,
    },

    checkIn: {
      type: Date,
      default: null,
    },

    checkOut: {
      type: Date,
      default: null,
    },

    workMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    lateMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    overtimeMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidDayValue: {
      type: Number,
      default: 1,
      min: 0,
      max: 1,
      set: round2,
    },

    absentDeductionDays: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
      set: round2,
    },

    unpaidLeaveDeductionDays: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
      set: round2,
    },

    isLateDeductible: {
      type: Boolean,
      default: false,
      index: true,
    },

    isOvertimeApproved: {
      type: Boolean,
      default: false,
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
attendanceSchema.index({ employee: 1, dayKey: 1 }, { unique: true });
attendanceSchema.index({ employee: 1, year: 1, month: 1, workDate: 1 });
attendanceSchema.index({ department: 1, year: 1, month: 1 });
attendanceSchema.index({ status: 1, year: 1, month: 1 });
attendanceSchema.index({ createdAt: -1, _id: -1 });

/* ===============================
   Auto normalize date + payroll values
================================ */
attendanceSchema.pre("validate", function (next) {
  const dateOnly = normalizeDateOnly(this.workDate);
  if (!dateOnly) return next(new Error("Invalid workDate."));

  this.workDate = dateOnly;
  this.dayKey = getDayKey(dateOnly);
  this.year = dateOnly.getFullYear();
  this.month = dateOnly.getMonth() + 1;

  this.workMinutes = Math.max(0, Number(this.workMinutes || 0));
  this.lateMinutes = Math.max(0, Number(this.lateMinutes || 0));
  this.overtimeMinutes = Math.max(0, Number(this.overtimeMinutes || 0));

  if (this.status === "present") {
    this.paidDayValue = 1;
    this.absentDeductionDays = 0;
    this.unpaidLeaveDeductionDays = 0;
    this.isLateDeductible = false;
  }

  if (this.status === "late") {
    this.paidDayValue = 1;
    this.absentDeductionDays = 0;
    this.unpaidLeaveDeductionDays = 0;
    this.isLateDeductible = true;
  }

  if (this.status === "half_day") {
    this.paidDayValue = 0.5;
    this.absentDeductionDays = 0.5;
    this.unpaidLeaveDeductionDays = 0;
  }

  if (this.status === "absent") {
    this.paidDayValue = 0;
    this.absentDeductionDays = 1;
    this.unpaidLeaveDeductionDays = 0;
    this.isLateDeductible = false;
  }

  if (this.status === "paid_leave") {
    this.paidDayValue = 1;
    this.absentDeductionDays = 0;
    this.unpaidLeaveDeductionDays = 0;
    this.isLateDeductible = false;
  }

  if (this.status === "unpaid_leave") {
    this.paidDayValue = 0;
    this.absentDeductionDays = 0;
    this.unpaidLeaveDeductionDays = 1;
    this.isLateDeductible = false;
  }

  if (this.status === "weekly_holiday" || this.status === "holiday") {
    this.paidDayValue = 1;
    this.absentDeductionDays = 0;
    this.unpaidLeaveDeductionDays = 0;
    this.isLateDeductible = false;
  }

  next();
});

export default mongoose.model("Attendance", attendanceSchema);