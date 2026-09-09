import mongoose from "mongoose";

const employeeReportViewPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // example: "employeeReport.list"
    key: { type: String, required: true, trim: true, index: true },

    // list of column keys: ["employee", "assigned", ...]
    columns: { type: [String], default: [] },
  },
  { timestamps: true, minimize: true }
);

employeeReportViewPreferenceSchema.index({ userId: 1, key: 1 }, { unique: true });

export default mongoose.model("EmployeeReportViewPreference", employeeReportViewPreferenceSchema);
