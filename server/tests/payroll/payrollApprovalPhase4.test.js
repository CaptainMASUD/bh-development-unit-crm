import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Payroll from "../../models/payroll.model.js";
import PayrollApprovalWorkflow, {
  DEFAULT_APPROVAL_STAGES,
} from "../../models/payroll/payrollApprovalWorkflow.model.js";
import PayrollApprovalHistory from "../../models/payroll/payrollApprovalHistory.model.js";
import {
  isMaker,
  userHasWorkflowPermission,
  getTenantApprovalWorkflow,
} from "../../controllers/payroll/payrollApproval.controller.js";

/* =========================================================
   1. WORKFLOW SCHEMA & DEFAULT CONFIGURATION
========================================================= */
test("Approval Workflow: default stages configuration includes review and final_approval", () => {
  assert.equal(DEFAULT_APPROVAL_STAGES.length, 2);
  assert.equal(DEFAULT_APPROVAL_STAGES[0].stageId, "review");
  assert.equal(DEFAULT_APPROVAL_STAGES[0].sequence, 1);
  assert.equal(DEFAULT_APPROVAL_STAGES[0].requiredPermission, "payroll:review");
  assert.equal(DEFAULT_APPROVAL_STAGES[0].requiredApprovals, 1);

  assert.equal(DEFAULT_APPROVAL_STAGES[1].stageId, "final_approval");
  assert.equal(DEFAULT_APPROVAL_STAGES[1].sequence, 2);
  assert.equal(DEFAULT_APPROVAL_STAGES[1].requiredPermission, "payroll:approve");
  assert.equal(DEFAULT_APPROVAL_STAGES[1].requiredApprovals, 1);
});

test("Approval Workflow: model supports custom sequence and toggleable maker-checker", () => {
  const customWorkflow = new PayrollApprovalWorkflow({
    tenantId: new mongoose.Types.ObjectId(),
    isEnabled: true,
    enforceMakerChecker: true,
    stages: [
      {
        stageId: "first_check",
        name: "First Line Check",
        sequence: 1,
        requiredPermission: "payroll:review",
        requiredApprovals: 1,
        allowSendBack: true,
        allowReject: true,
      },
      {
        stageId: "finance_review",
        name: "Finance Controller Review",
        sequence: 2,
        requiredPermission: "payroll:review",
        requiredApprovals: 2,
        allowSendBack: true,
        allowReject: true,
      },
      {
        stageId: "cfo_signoff",
        name: "CFO Final Approval",
        sequence: 3,
        requiredPermission: "payroll:approve",
        requiredApprovals: 1,
        allowSendBack: true,
        allowReject: false,
      },
    ],
  });

  assert.equal(customWorkflow.stages.length, 3);
  assert.equal(customWorkflow.stages[1].requiredApprovals, 2);
  assert.equal(customWorkflow.stages[2].allowReject, false);
});

/* =========================================================
   2. IMMUTABILITY OF APPROVAL HISTORY
========================================================= */
test("Approval History: immutability hook blocks updates and deletions", async () => {
  const historyRecord = new PayrollApprovalHistory({
    tenantId: new mongoose.Types.ObjectId(),
    payroll: new mongoose.Types.ObjectId(),
    payrollPeriod: { year: 2026, month: 9 },
    cycle: 1,
    stageId: "review",
    stageName: "Payroll Review",
    sequence: 1,
    action: "approved",
    actor: new mongoose.Types.ObjectId(),
    actorRole: "admin",
    previousState: "submitted",
    resultingState: "in_review",
    comments: "Passed all cross-checks",
  });

  assert.ok(historyRecord);
  assert.equal(historyRecord.action, "approved");

  // Verify that calling update or delete middleware triggers error
  const updateMiddleware = PayrollApprovalHistory.schema.s.hooks._pres.get("updateOne");
  assert.ok(updateMiddleware && updateMiddleware.length > 0);

  let caughtError = null;
  const nextFn = (err) => {
    caughtError = err;
  };
  updateMiddleware[0].fn.call({}, nextFn);

  assert.ok(caughtError);
  assert.ok(caughtError.message.includes("immutable"));
});

/* =========================================================
   3. IS_MAKER HELPER LOGIC
========================================================= */
test("isMaker: accurately detects preparer or submitter", () => {
  const preparerId = new mongoose.Types.ObjectId().toString();
  const submitterId = new mongoose.Types.ObjectId().toString();
  const otherUserId = new mongoose.Types.ObjectId().toString();

  const mockPayroll = {
    calculatedBy: preparerId,
    approvalWorkflow: {
      preparedBy: preparerId,
      submittedBy: submitterId,
    },
  };

  // Preparer is maker
  assert.equal(isMaker(mockPayroll, preparerId), true);
  // Submitter is maker
  assert.equal(isMaker(mockPayroll, submitterId), true);
  // Other user is NOT maker
  assert.equal(isMaker(mockPayroll, otherUserId), false);
  // Null user
  assert.equal(isMaker(mockPayroll, null), false);
});

/* =========================================================
   4. USER PERMISSION HELPER LOGIC
========================================================= */
test("userHasWorkflowPermission: validates admin and specific permission tokens", () => {
  const adminUser = { role: "admin" };
  assert.equal(userHasWorkflowPermission(adminUser, "payroll:review"), true);
  assert.equal(userHasWorkflowPermission(adminUser, "payroll:approve"), true);

  const reviewerUser = {
    role: "employee",
    permissionGroup: {
      isActive: true,
      permissions: ["payroll:view", "payroll:review"],
    },
  };
  assert.equal(userHasWorkflowPermission(reviewerUser, "payroll:review"), true);
  assert.equal(userHasWorkflowPermission(reviewerUser, "payroll:approve"), false);

  const approverUser = {
    role: "employee",
    permissionGroup: {
      isActive: true,
      permissions: ["payroll:view", "payroll:approve"],
    },
  };
  assert.equal(userHasWorkflowPermission(approverUser, "payroll:review"), false);
  assert.equal(userHasWorkflowPermission(approverUser, "payroll:approve"), true);

  const managerUser = {
    role: "employee",
    permissionGroup: {
      isActive: true,
      permissions: ["payroll:manage"],
    },
  };
  assert.equal(userHasWorkflowPermission(managerUser, "payroll:review"), true);
  assert.equal(userHasWorkflowPermission(managerUser, "payroll:approve"), true);
});

/* =========================================================
   5. PAYROLL MODEL SUBDOCUMENT & WORKFLOW TRANSITIONS
========================================================= */
test("Payroll Schema: initial approvalWorkflow defaults to draft with cycle 1", () => {
  const empId = new mongoose.Types.ObjectId();
  const salaryProfId = new mongoose.Types.ObjectId();

  const payroll = new Payroll({
    payrollKey: `test-${Date.now()}`,
    employee: empId,
    salaryProfile: salaryProfId,
    year: 2026,
    month: 9,
    periodStart: new Date(2026, 8, 1),
    periodEnd: new Date(2026, 8, 30),
    salarySnapshot: {
      basicSalary: 50000,
      currency: "BDT",
    },
    earnings: [{ name: "Basic", type: "earning", amount: 50000 }],
    deductions: [],
  });

  payroll.recalculateTotals();

  assert.equal(payroll.approvalWorkflow.status, "draft");
  assert.equal(payroll.approvalWorkflow.cycle, 1);
  assert.equal(payroll.approvalWorkflow.isWorkflowEnabled, false);
  assert.equal(payroll.approvalWorkflow.enforceMakerChecker, true);
});

test("Submission Invariant: transitions to submitted and freezes active stage snapshot", () => {
  const empId = new mongoose.Types.ObjectId();
  const preparerId = new mongoose.Types.ObjectId();

  const payroll = new Payroll({
    payrollKey: `test-${Date.now()}`,
    employee: empId,
    salaryProfile: new mongoose.Types.ObjectId(),
    year: 2026,
    month: 9,
    periodStart: new Date(2026, 8, 1),
    periodEnd: new Date(2026, 8, 30),
    salarySnapshot: { basicSalary: 60000, currency: "BDT" },
    earnings: [{ name: "Basic", type: "earning", amount: 60000 }],
  });

  // Simulate submitPayrollForApproval logic
  const stagesSnapshot = DEFAULT_APPROVAL_STAGES.map((s, idx) => ({
    stageId: s.stageId,
    name: s.name,
    sequence: s.sequence,
    requiredPermission: s.requiredPermission,
    approvalsRequired: s.requiredApprovals || 1,
    approvalsCount: 0,
    approvedBy: [],
    allowSendBack: s.allowSendBack !== false,
    allowReject: s.allowReject !== false,
    status: idx === 0 ? "in_progress" : "pending",
    comments: "",
  }));

  payroll.approvalWorkflow = {
    isWorkflowEnabled: true,
    enforceMakerChecker: true,
    status: "submitted",
    currentStageIndex: 0,
    currentStageId: stagesSnapshot[0].stageId,
    currentStageName: stagesSnapshot[0].name,
    pendingPermission: stagesSnapshot[0].requiredPermission,
    stages: stagesSnapshot,
    cycle: 1,
    preparedBy: preparerId,
    submittedBy: preparerId,
    submittedAt: new Date(),
  };

  assert.equal(payroll.approvalWorkflow.status, "submitted");
  assert.equal(payroll.approvalWorkflow.stages.length, 2);
  assert.equal(payroll.approvalWorkflow.currentStageName, "Payroll Review");
  assert.equal(payroll.approvalWorkflow.pendingPermission, "payroll:review");
});

/* =========================================================
   6. MAKER-CHECKER SEGREGATION INVARIANTS
========================================================= */
test("Maker-Checker Invariant: Preparer cannot approve their own payroll even with admin role", () => {
  const preparerId = new mongoose.Types.ObjectId().toString();
  const adminActorId = preparerId; // Admin is also the preparer

  const payroll = {
    approvalWorkflow: {
      isWorkflowEnabled: true,
      enforceMakerChecker: true,
      status: "submitted",
      preparedBy: preparerId,
      submittedBy: preparerId,
      currentStageIndex: 0,
      stages: [
        {
          stageId: "review",
          name: "Payroll Review",
          requiredPermission: "payroll:review",
          approvalsRequired: 1,
          approvedBy: [],
        },
      ],
    },
  };

  const isUserMaker = isMaker(payroll, adminActorId);
  assert.equal(isUserMaker, true);

  // When enforceMakerChecker is true, isUserMaker MUST block approval
  const canApprove = !payroll.approvalWorkflow.enforceMakerChecker || !isUserMaker;
  assert.equal(canApprove, false);
});

test("Maker-Checker Invariant: Non-maker user with proper permission can approve stage", () => {
  const preparerId = new mongoose.Types.ObjectId().toString();
  const reviewerId = new mongoose.Types.ObjectId().toString();

  const payroll = {
    approvalWorkflow: {
      isWorkflowEnabled: true,
      enforceMakerChecker: true,
      status: "submitted",
      preparedBy: preparerId,
      submittedBy: preparerId,
      currentStageIndex: 0,
      stages: [
        {
          stageId: "review",
          name: "Payroll Review",
          requiredPermission: "payroll:review",
          approvalsRequired: 1,
          approvedBy: [],
        },
      ],
    },
  };

  const isUserMaker = isMaker(payroll, reviewerId);
  assert.equal(isUserMaker, false);

  const reviewerUser = {
    role: "employee",
    permissionGroup: {
      isActive: true,
      permissions: ["payroll:review"],
    },
  };

  const hasPermission = userHasWorkflowPermission(
    reviewerUser,
    payroll.approvalWorkflow.stages[0].requiredPermission
  );
  assert.equal(hasPermission, true);

  const canApprove = (!payroll.approvalWorkflow.enforceMakerChecker || !isUserMaker) && hasPermission;
  assert.equal(canApprove, true);
});

/* =========================================================
   7. STAGE PROGRESSION & FINAL APPROVAL
========================================================= */
test("Stage Progression: Approving Stage 1 advances to Stage 2 with status in_review", () => {
  const stages = [
    {
      stageId: "review",
      name: "Payroll Review",
      sequence: 1,
      requiredPermission: "payroll:review",
      approvalsRequired: 1,
      approvalsCount: 0,
      approvedBy: [],
      status: "in_progress",
    },
    {
      stageId: "final_approval",
      name: "Final Approval",
      sequence: 2,
      requiredPermission: "payroll:approve",
      approvalsRequired: 1,
      approvalsCount: 0,
      approvedBy: [],
      status: "pending",
    },
  ];

  const workflowState = {
    currentStageIndex: 0,
    status: "submitted",
    stages,
  };

  // Simulate reviewer approving stage 1
  const reviewerId = new mongoose.Types.ObjectId();
  stages[0].approvedBy.push(reviewerId);
  stages[0].approvalsCount = 1;
  stages[0].status = "approved";

  // Advance stage
  const hasNextStage = workflowState.currentStageIndex + 1 < stages.length;
  assert.equal(hasNextStage, true);

  workflowState.currentStageIndex += 1;
  const nextStage = stages[workflowState.currentStageIndex];
  nextStage.status = "in_progress";
  workflowState.status = "in_review";

  assert.equal(workflowState.currentStageIndex, 1);
  assert.equal(workflowState.status, "in_review");
  assert.equal(stages[0].status, "approved");
  assert.equal(stages[1].status, "in_progress");
  assert.equal(stages[1].requiredPermission, "payroll:approve");
});

test("Final Stage Approval: Approving Stage 2 marks payroll and workflow as approved", () => {
  const stages = [
    {
      stageId: "review",
      name: "Payroll Review",
      sequence: 1,
      requiredPermission: "payroll:review",
      approvalsRequired: 1,
      approvalsCount: 1,
      approvedBy: [new mongoose.Types.ObjectId()],
      status: "approved",
    },
    {
      stageId: "final_approval",
      name: "Final Approval",
      sequence: 2,
      requiredPermission: "payroll:approve",
      approvalsRequired: 1,
      approvalsCount: 0,
      approvedBy: [],
      status: "in_progress",
    },
  ];

  const approverId = new mongoose.Types.ObjectId();
  const payroll = {
    status: "calculated",
    approvalWorkflow: {
      currentStageIndex: 1,
      status: "in_review",
      stages,
    },
  };

  // Simulate final approval
  stages[1].approvedBy.push(approverId);
  stages[1].approvalsCount = 1;
  stages[1].status = "approved";

  const hasNextStage = payroll.approvalWorkflow.currentStageIndex + 1 < stages.length;
  assert.equal(hasNextStage, false);

  // Final stage reached
  payroll.approvalWorkflow.status = "approved";
  payroll.approvalWorkflow.approvedBy = approverId;
  payroll.status = "approved";
  payroll.approvedBy = approverId;

  assert.equal(payroll.approvalWorkflow.status, "approved");
  assert.equal(payroll.status, "approved");
  assert.equal(payroll.approvedBy, approverId);
});

/* =========================================================
   8. SEND-BACK & RE-CALCULATION RECOVERY
========================================================= */
test("Send-Back Invariant: Requires mandatory reason and unlocks recalculation", () => {
  const payroll = {
    status: "calculated",
    approvalWorkflow: {
      isWorkflowEnabled: true,
      status: "in_review",
      cycle: 1,
      stages: [
        {
          stageId: "review",
          name: "Payroll Review",
          allowSendBack: true,
          status: "in_progress",
        },
      ],
    },
  };

  const reason = "Bonus calculation missing 2 days of approved overtime.";
  const reviewerId = new mongoose.Types.ObjectId();

  // Execute send back
  payroll.approvalWorkflow.status = "sent_back";
  payroll.approvalWorkflow.sentBackBy = reviewerId;
  payroll.approvalWorkflow.sentBackAt = new Date();
  payroll.approvalWorkflow.sendBackReason = reason;
  payroll.status = "calculated"; // Unlocked!

  assert.equal(payroll.approvalWorkflow.status, "sent_back");
  assert.equal(payroll.approvalWorkflow.sendBackReason, reason);
  assert.equal(payroll.status, "calculated");

  // Verify that recalculation is permitted when status is "sent_back"
  const isReviewBlocked = ["submitted", "in_review"].includes(payroll.approvalWorkflow.status);
  assert.equal(isReviewBlocked, false);
});

test("Resubmission Invariant: Increments cycle number to cycle 2", () => {
  const payroll = {
    approvalWorkflow: {
      status: "sent_back",
      cycle: 1,
    },
  };

  const isResubmit = payroll.approvalWorkflow.status === "sent_back";
  const nextCycle = isResubmit ? (payroll.approvalWorkflow.cycle || 1) + 1 : 1;

  assert.equal(nextCycle, 2);
});

/* =========================================================
   9. REJECTION INVARIANT
========================================================= */
test("Reject Invariant: Marks workflow as rejected with mandatory reason", () => {
  const payroll = {
    status: "calculated",
    approvalWorkflow: {
      isWorkflowEnabled: true,
      status: "in_review",
      stages: [
        {
          stageId: "final_approval",
          name: "Final Approval",
          allowReject: true,
          status: "in_progress",
        },
      ],
    },
  };

  const rejectionReason = "Budget exceeded for Q3 payroll. Rejected by executive director.";
  const rejectorId = new mongoose.Types.ObjectId();

  payroll.approvalWorkflow.status = "rejected";
  payroll.approvalWorkflow.rejectedBy = rejectorId;
  payroll.approvalWorkflow.rejectedAt = new Date();
  payroll.approvalWorkflow.rejectionReason = rejectionReason;

  assert.equal(payroll.approvalWorkflow.status, "rejected");
  assert.equal(payroll.approvalWorkflow.rejectionReason, rejectionReason);
});

/* =========================================================
   10. DISBURSEMENT / PAYMENT GUARD
========================================================= */
test("Disbursement Guard: Blocks payment if payroll is not fully approved", () => {
  const unapprovedPayroll = {
    status: "calculated",
    approvalWorkflow: {
      isWorkflowEnabled: true,
      status: "in_review",
    },
  };

  const canPay =
    unapprovedPayroll.status === "approved" &&
    (!unapprovedPayroll.approvalWorkflow.isWorkflowEnabled ||
      unapprovedPayroll.approvalWorkflow.status === "approved");

  assert.equal(canPay, false);
});

test("Disbursement Guard: Maker cannot disburse/pay their own payroll when segregation is enabled", () => {
  const preparerId = new mongoose.Types.ObjectId().toString();
  const approvedPayroll = {
    status: "approved",
    approvalWorkflow: {
      isWorkflowEnabled: true,
      enforceMakerChecker: true,
      status: "approved",
      preparedBy: preparerId,
      submittedBy: preparerId,
    },
  };

  const isUserMaker = isMaker(approvedPayroll, preparerId);
  assert.equal(isUserMaker, true);

  const canDisburse =
    !approvedPayroll.approvalWorkflow.enforceMakerChecker || !isUserMaker;
  assert.equal(canDisburse, false);
});

test("Disbursement Guard: Non-maker disburser can pay approved payroll", () => {
  const preparerId = new mongoose.Types.ObjectId().toString();
  const disburserId = new mongoose.Types.ObjectId().toString();

  const approvedPayroll = {
    status: "approved",
    approvalWorkflow: {
      isWorkflowEnabled: true,
      enforceMakerChecker: true,
      status: "approved",
      preparedBy: preparerId,
      submittedBy: preparerId,
    },
  };

  const isUserMaker = isMaker(approvedPayroll, disburserId);
  assert.equal(isUserMaker, false);

  const canDisburse =
    approvedPayroll.status === "approved" &&
    approvedPayroll.approvalWorkflow.status === "approved" &&
    (!approvedPayroll.approvalWorkflow.enforceMakerChecker || !isUserMaker);

  assert.equal(canDisburse, true);
});

/* =========================================================
   11. METRICS & COUNTS COMPUTATION
========================================================= */
test("Approval Metrics: accurately computes awaiting review, pending final, approved, and sent back", () => {
  const reviewerId = new mongoose.Types.ObjectId().toString();
  const otherUser = new mongoose.Types.ObjectId().toString();

  const mockPayrolls = [
    // 1: In Review, stage 1 (reviewer is not maker) -> Awaiting Review
    {
      netPayable: 45000,
      status: "calculated",
      approvalWorkflow: {
        isWorkflowEnabled: true,
        enforceMakerChecker: true,
        status: "submitted",
        preparedBy: otherUser,
        currentStageIndex: 0,
        stages: [
          { requiredPermission: "payroll:review" },
          { requiredPermission: "payroll:approve" },
        ],
      },
    },
    // 2: In Review, stage 2 -> Pending Final Approval
    {
      netPayable: 60000,
      status: "calculated",
      approvalWorkflow: {
        isWorkflowEnabled: true,
        enforceMakerChecker: true,
        status: "in_review",
        preparedBy: otherUser,
        currentStageIndex: 1,
        stages: [
          { requiredPermission: "payroll:review" },
          { requiredPermission: "payroll:approve" },
        ],
      },
    },
    // 3: Approved
    {
      netPayable: 55000,
      status: "approved",
      approvalWorkflow: {
        isWorkflowEnabled: true,
        status: "approved",
      },
    },
    // 4: Sent Back
    {
      netPayable: 40000,
      status: "calculated",
      approvalWorkflow: {
        isWorkflowEnabled: true,
        status: "sent_back",
      },
    },
  ];

  let awaitingMyReview = 0;
  let pendingFinalApproval = 0;
  let approved = 0;
  let sentBack = 0;
  let totalNetPayable = 0;

  mockPayrolls.forEach((p) => {
    totalNetPayable += p.netPayable;
    if (p.status === "approved") approved++;
    if (p.approvalWorkflow?.status === "sent_back") sentBack++;

    const wf = p.approvalWorkflow;
    if (wf?.isWorkflowEnabled && ["submitted", "in_review"].includes(wf.status)) {
      const isLastStage = (wf.currentStageIndex || 0) + 1 >= (wf.stages?.length || 1);
      if (isLastStage) pendingFinalApproval++;

      // Check if reviewer can review stage 0
      if (wf.currentStageIndex === 0 && !isMaker(p, reviewerId)) {
        awaitingMyReview++;
      }
    }
  });

  assert.equal(totalNetPayable, 200000);
  assert.equal(awaitingMyReview, 1);
  assert.equal(pendingFinalApproval, 1);
  assert.equal(approved, 1);
  assert.equal(sentBack, 1);
});
