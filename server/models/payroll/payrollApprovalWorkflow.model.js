import mongoose from "mongoose";

const approvalStageSchema = new mongoose.Schema(
  {
    stageId: {
      type: String,
      required: true,
      trim: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sequence: {
      type: Number,
      required: true,
      min: 1,
    },
    requiredPermission: {
      type: String,
      required: true,
      trim: true,
      default: "payroll:approve",
    },
    requiredApprovals: {
      type: Number,
      default: 1,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    requireComments: {
      type: Boolean,
      default: false,
    },
    allowSendBack: {
      type: Boolean,
      default: true,
    },
    allowReject: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

export const DEFAULT_APPROVAL_STAGES = [
  {
    stageId: "review",
    name: "Payroll Review",
    sequence: 1,
    requiredPermission: "payroll:review",
    requiredApprovals: 1,
    isActive: true,
    description: "Initial payroll cross-check and review of salary components",
    requireComments: false,
    allowSendBack: true,
    allowReject: true,
  },
  {
    stageId: "final_approval",
    name: "Final Approval",
    sequence: 2,
    requiredPermission: "payroll:approve",
    requiredApprovals: 1,
    isActive: true,
    description: "Executive authorization and accounting accrual confirmation",
    requireComments: false,
    allowSendBack: true,
    allowReject: true,
  },
];

const payrollApprovalWorkflowSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    enforceMakerChecker: {
      type: Boolean,
      default: true,
    },
    stages: {
      type: [approvalStageSchema],
      default: () => DEFAULT_APPROVAL_STAGES,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

payrollApprovalWorkflowSchema.index({ tenantId: 1 }, { unique: true, sparse: true });

export default mongoose.models.PayrollApprovalWorkflow ||
  mongoose.model("PayrollApprovalWorkflow", payrollApprovalWorkflowSchema);
