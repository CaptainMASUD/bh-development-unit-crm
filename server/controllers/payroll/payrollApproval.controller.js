import mongoose from "mongoose";
import Payroll from "../../models/payroll.model.js";
import PayrollApprovalWorkflow, {
  DEFAULT_APPROVAL_STAGES,
} from "../../models/payroll/payrollApprovalWorkflow.model.js";
import PayrollApprovalHistory from "../../models/payroll/payrollApprovalHistory.model.js";
import PayrollAudit from "../../models/payroll/payrollAudit.model.js";
import {
  checkPeriodLocked,
  ensurePayrollAccrual,
  populatePayrollQuery,
  assertPayrollTenant,
  isValidObjectId,
  clean,
  roundMoney,
} from "./payroll.controller.js";

/**
 * Check if a user has a specific workflow stage permission
 */
export const userHasWorkflowPermission = (user, requiredPermission) => {
  if (!user) return false;
  if (["admin", "superadmin"].includes(user.role)) return true;
  const permissions =
    user.permissionGroup?.isActive === false
      ? []
      : user.permissionGroup?.permissions || [];
  if (permissions.includes(requiredPermission)) return true;
  if (permissions.includes("payroll:manage")) return true;
  return false;
};

/**
 * Check if the given user is the maker / preparer of this payroll
 */
export const isMaker = (payroll, userId) => {
  if (!payroll || !userId) return false;
  const uid = String(userId);
  const prep = String(
    payroll.approvalWorkflow?.preparedBy || payroll.calculatedBy || ""
  );
  const subm = String(payroll.approvalWorkflow?.submittedBy || "");
  return prep === uid || subm === uid;
};

/**
 * Get or initialize workflow configuration for a tenant
 */
export const getTenantApprovalWorkflow = async (tenantId) => {
  let workflow = await PayrollApprovalWorkflow.findOne(
    tenantId ? { tenantId } : { tenantId: null }
  );

  if (!workflow && tenantId) {
    workflow = await PayrollApprovalWorkflow.findOne({ tenantId: null });
  }

  if (!workflow) {
    workflow = await PayrollApprovalWorkflow.create({
      tenantId: tenantId || null,
      isEnabled: true,
      enforceMakerChecker: true,
      stages: DEFAULT_APPROVAL_STAGES,
    });
  }

  return workflow;
};

/* ===============================
   WORKFLOW CONFIGURATION ENDPOINTS
================================ */

export const getApprovalWorkflow = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const workflow = await getTenantApprovalWorkflow(tenantId);
    return res.json({ workflow });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getApprovalWorkflow.",
      error: err.message,
    });
  }
};

export const updateApprovalWorkflow = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const { isEnabled, enforceMakerChecker, stages } = req.body;

    let workflow = await PayrollApprovalWorkflow.findOne(
      tenantId ? { tenantId } : { tenantId: null }
    );

    if (!workflow) {
      workflow = new PayrollApprovalWorkflow({ tenantId });
    }

    if (typeof isEnabled === "boolean") workflow.isEnabled = isEnabled;
    if (typeof enforceMakerChecker === "boolean") {
      workflow.enforceMakerChecker = enforceMakerChecker;
    }

    if (Array.isArray(stages)) {
      if (stages.length === 0 && workflow.isEnabled) {
        return res.status(400).json({
          message: "At least one approval stage is required when workflow is enabled.",
        });
      }

      // Validate stages
      const normalizedStages = stages.map((s, idx) => ({
        stageId: clean(s.stageId) || `stage_${idx + 1}`,
        name: clean(s.name) || `Stage ${idx + 1}`,
        sequence: Number(s.sequence) || idx + 1,
        requiredPermission: clean(s.requiredPermission) || "payroll:approve",
        requiredApprovals: Math.max(1, Number(s.requiredApprovals) || 1),
        isActive: s.isActive !== false,
        description: clean(s.description),
        requireComments: Boolean(s.requireComments),
        allowSendBack: s.allowSendBack !== false,
        allowReject: s.allowReject !== false,
      }));

      workflow.stages = normalizedStages;
    }

    workflow.updatedBy = req.user?._id || null;
    await workflow.save();

    return res.json({
      message: "Payroll approval workflow configuration updated.",
      workflow,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in updateApprovalWorkflow.",
      error: err.message,
    });
  }
};

/* ===============================
   SUBMIT PAYROLL FOR APPROVAL
================================ */

export const submitPayrollForApproval = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found." });

    if (!assertPayrollTenant(req, payroll)) {
      return res.status(403).json({ message: "Access forbidden to this payroll record." });
    }

    if (await checkPeriodLocked(payroll.year, payroll.month)) {
      return res.status(403).json({
        message: `Payroll period ${payroll.year}-${String(payroll.month).padStart(2, "0")} is locked.`,
      });
    }

    if (["paid", "cancelled", "reversed"].includes(payroll.status)) {
      return res.status(400).json({
        message: `Cannot submit payroll with status '${payroll.status}' for approval.`,
      });
    }

    if (["submitted", "in_review", "approved"].includes(payroll.approvalWorkflow?.status)) {
      return res.status(400).json({
        message: `Payroll is already in '${payroll.approvalWorkflow.status}' state.`,
      });
    }

    const workflow = await getTenantApprovalWorkflow(payroll.tenantId || req.tenantId);

    if (!workflow.isEnabled) {
      return res.status(400).json({
        message: "Approval workflow is currently disabled for this tenant.",
      });
    }

    const activeStages = (workflow.stages || [])
      .filter((s) => s.isActive !== false)
      .sort((a, b) => a.sequence - b.sequence);

    if (activeStages.length === 0) {
      return res.status(400).json({
        message: "No active approval stages configured for this tenant.",
      });
    }

    const stagesSnapshot = activeStages.map((s, idx) => ({
      stageId: s.stageId || `stage_${idx + 1}`,
      name: s.name,
      sequence: s.sequence || idx + 1,
      requiredPermission: s.requiredPermission || "payroll:approve",
      approvalsRequired: s.requiredApprovals || 1,
      approvalsCount: 0,
      approvedBy: [],
      allowSendBack: s.allowSendBack !== false,
      allowReject: s.allowReject !== false,
      status: idx === 0 ? "in_progress" : "pending",
      comments: "",
      actedAt: null,
    }));

    const isResubmit = payroll.approvalWorkflow?.status === "sent_back";
    const currentCycle = isResubmit
      ? (payroll.approvalWorkflow?.cycle || 1) + 1
      : payroll.approvalWorkflow?.cycle || 1;

    payroll.approvalWorkflow = {
      isWorkflowEnabled: true,
      enforceMakerChecker: workflow.enforceMakerChecker !== false,
      status: "submitted",
      currentStageIndex: 0,
      currentStageId: stagesSnapshot[0].stageId,
      currentStageName: stagesSnapshot[0].name,
      pendingPermission: stagesSnapshot[0].requiredPermission,
      stages: stagesSnapshot,
      cycle: currentCycle,
      preparedBy: payroll.approvalWorkflow?.preparedBy || payroll.calculatedBy || req.user._id,
      submittedBy: req.user._id,
      submittedAt: new Date(),
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: "",
      sentBackBy: null,
      sentBackAt: null,
      sendBackReason: "",
    };

    if (!Array.isArray(payroll.auditTrail)) payroll.auditTrail = [];
    payroll.auditTrail.push({
      action: isResubmit ? "resubmitted_for_approval" : "submitted_for_approval",
      performedBy: req.user._id,
      performedAt: new Date(),
      previousStatus: payroll.status,
      newStatus: payroll.status,
      reason: clean(req.body.comments) || clean(req.body.reason) || "Submitted for approval review",
      note: `Cycle ${currentCycle}, Stage: ${stagesSnapshot[0].name}`,
    });

    await payroll.save();

    await PayrollApprovalHistory.create({
      tenantId: payroll.tenantId || null,
      payroll: payroll._id,
      payrollPeriod: { year: payroll.year, month: payroll.month },
      cycle: currentCycle,
      stageId: stagesSnapshot[0].stageId,
      stageName: stagesSnapshot[0].name,
      sequence: 1,
      action: isResubmit ? "resubmitted" : "submitted",
      actor: req.user._id,
      actorRole: req.user.role || "employee",
      actorPermission: req.user.permissionGroup?.name || "",
      previousState: isResubmit ? "sent_back" : "draft",
      resultingState: "submitted",
      comments: clean(req.body.comments) || clean(req.body.reason) || "Submitted for review",
      ipAddress: req.ip || "",
      userAgent: req.get("User-Agent") || "",
    });

    await PayrollAudit.create({
      payroll: payroll._id,
      payrollKey: payroll.payrollKey,
      employee: payroll.employee,
      year: payroll.year,
      month: payroll.month,
      action: isResubmit ? "resubmitted" : "submitted",
      performedBy: req.user._id,
      performedAt: new Date(),
      previousStatus: payroll.status,
      newStatus: payroll.status,
      reason: clean(req.body.comments) || clean(req.body.reason) || "Submitted for approval review",
    }).catch(() => {});

    const full = await populatePayrollQuery(Payroll.findById(payroll._id)).lean();

    return res.json({
      message: `Payroll submitted for ${stagesSnapshot[0].name}.`,
      payroll: full,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in submitPayrollForApproval.",
      error: err.message,
    });
  }
};

export const bulkSubmitPayrollForApproval = async (req, res) => {
  try {
    const { payrollIds, year, month, department } = req.body;
    const filter = {};

    if (Array.isArray(payrollIds) && payrollIds.length > 0) {
      filter._id = { $in: payrollIds.filter(isValidObjectId) };
    } else if (year && month) {
      filter.year = Number(year);
      filter.month = Number(month);
      if (department && isValidObjectId(department)) {
        filter.department = department;
      }
    } else {
      return res.status(400).json({
        message: "Provide either payrollIds or year and month.",
      });
    }

    const tenantId = req.tenantId || req.user?.tenantId;
    if (tenantId) {
      filter.$or = [{ tenantId }, { tenantId: null }];
    }

    filter.status = { $in: ["calculated", "draft"] };

    const payrolls = await Payroll.find(filter);
    const results = { submitted: 0, skipped: 0, errors: [] };

    for (const payroll of payrolls) {
      try {
        if (!assertPayrollTenant(req, payroll)) {
          results.skipped++;
          continue;
        }

        if (["submitted", "in_review", "approved"].includes(payroll.approvalWorkflow?.status)) {
          results.skipped++;
          continue;
        }

        const workflow = await getTenantApprovalWorkflow(payroll.tenantId || tenantId);
        if (!workflow.isEnabled) {
          results.skipped++;
          continue;
        }

        const activeStages = (workflow.stages || [])
          .filter((s) => s.isActive !== false)
          .sort((a, b) => a.sequence - b.sequence);

        if (activeStages.length === 0) {
          results.skipped++;
          continue;
        }

        const stagesSnapshot = activeStages.map((s, idx) => ({
          stageId: s.stageId || `stage_${idx + 1}`,
          name: s.name,
          sequence: s.sequence || idx + 1,
          requiredPermission: s.requiredPermission || "payroll:approve",
          approvalsRequired: s.requiredApprovals || 1,
          approvalsCount: 0,
          approvedBy: [],
          allowSendBack: s.allowSendBack !== false,
          allowReject: s.allowReject !== false,
          status: idx === 0 ? "in_progress" : "pending",
          comments: "",
          actedAt: null,
        }));

        const isResubmit = payroll.approvalWorkflow?.status === "sent_back";
        const currentCycle = isResubmit
          ? (payroll.approvalWorkflow?.cycle || 1) + 1
          : payroll.approvalWorkflow?.cycle || 1;

        payroll.approvalWorkflow = {
          isWorkflowEnabled: true,
          enforceMakerChecker: workflow.enforceMakerChecker !== false,
          status: "submitted",
          currentStageIndex: 0,
          currentStageId: stagesSnapshot[0].stageId,
          currentStageName: stagesSnapshot[0].name,
          pendingPermission: stagesSnapshot[0].requiredPermission,
          stages: stagesSnapshot,
          cycle: currentCycle,
          preparedBy: payroll.approvalWorkflow?.preparedBy || payroll.calculatedBy || req.user._id,
          submittedBy: req.user._id,
          submittedAt: new Date(),
        };

        await payroll.save();

        await PayrollApprovalHistory.create({
          tenantId: payroll.tenantId || null,
          payroll: payroll._id,
          payrollPeriod: { year: payroll.year, month: payroll.month },
          cycle: currentCycle,
          stageId: stagesSnapshot[0].stageId,
          stageName: stagesSnapshot[0].name,
          sequence: 1,
          action: isResubmit ? "resubmitted" : "submitted",
          actor: req.user._id,
          comments: clean(req.body.comments) || "Bulk submitted for review",
        });

        results.submitted++;
      } catch (err) {
        results.errors.push({ id: payroll._id, error: err.message });
      }
    }

    return res.json({
      message: `Bulk submission complete: ${results.submitted} submitted, ${results.skipped} skipped.`,
      results,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in bulkSubmitPayrollForApproval.",
      error: err.message,
    });
  }
};

/* ===============================
   APPROVE PAYROLL STAGE
================================ */

export const approvePayrollStage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found." });

    if (!assertPayrollTenant(req, payroll)) {
      return res.status(403).json({ message: "Access forbidden to this payroll record." });
    }

    if (await checkPeriodLocked(payroll.year, payroll.month)) {
      return res.status(403).json({
        message: `Payroll period ${payroll.year}-${String(payroll.month).padStart(2, "0")} is locked.`,
      });
    }

    if (payroll.status === "paid") {
      return res.status(400).json({ message: "Paid payroll cannot be approved again." });
    }
    if (payroll.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled payroll cannot be approved." });
    }
    if (payroll.status === "reversed") {
      return res.status(400).json({
        message: "Reversed payroll cannot be directly approved. Recalculate it first.",
      });
    }

    // Legacy or Disabled Workflow Mode:
    if (!payroll.approvalWorkflow?.isWorkflowEnabled) {
      if (payroll.status === "approved") {
        return res.status(400).json({ message: "Payroll is already approved." });
      }

      await ensurePayrollAccrual({ payroll, userId: req.user?._id || null });
      payroll.status = "approved";
      payroll.approvedBy = req.user?._id || null;
      payroll.approvedAt = new Date();

      if (!Array.isArray(payroll.auditTrail)) payroll.auditTrail = [];
      payroll.auditTrail.push({
        action: "approved",
        performedBy: req.user?._id || null,
        performedAt: new Date(),
        previousStatus: "calculated",
        newStatus: "approved",
        reason: clean(req.body.comments) || clean(req.body.reason) || "Payroll approved",
      });

      await payroll.save();

      const full = await populatePayrollQuery(Payroll.findById(payroll._id)).lean();
      return res.json({
        message: "Payroll approved and accrued to accounting.",
        payroll: full,
      });
    }

    // Enabled Workflow Mode:
    const workflowState = payroll.approvalWorkflow;

    if (workflowState.status === "approved") {
      return res.status(400).json({ message: "Payroll is already approved." });
    }

    if (!["submitted", "in_review"].includes(workflowState.status)) {
      return res.status(400).json({
        message: `Payroll cannot be approved from '${workflowState.status}' status. Submit it for review first.`,
      });
    }

    const stages = workflowState.stages || [];
    const stageIndex = workflowState.currentStageIndex || 0;
    const currentStage = stages[stageIndex];

    if (!currentStage) {
      return res.status(400).json({ message: "Current approval stage not found on payroll." });
    }

    // Maker-Checker Segregation Rule:
    if (workflowState.enforceMakerChecker) {
      if (isMaker(payroll, req.user._id)) {
        return res.status(403).json({
          message: "Maker-checker violation: Preparer cannot approve their own payroll.",
        });
      }
    }

    // Required Permission Check:
    if (!userHasWorkflowPermission(req.user, currentStage.requiredPermission)) {
      return res.status(403).json({
        message: `Forbidden: Missing required permission '${currentStage.requiredPermission}' for stage '${currentStage.name}'.`,
      });
    }

    // Prevent duplicate approval in same stage:
    const alreadyApprovedByMe = (currentStage.approvedBy || []).some(
      (uid) => String(uid) === String(req.user._id)
    );
    if (alreadyApprovedByMe) {
      return res.status(400).json({ message: "You have already approved this stage." });
    }

    // Record approval in stage
    if (!Array.isArray(currentStage.approvedBy)) currentStage.approvedBy = [];
    currentStage.approvedBy.push(req.user._id);
    currentStage.approvalsCount = (currentStage.approvalsCount || 0) + 1;
    currentStage.actedAt = new Date();
    if (req.body.comments) {
      currentStage.comments = clean(req.body.comments);
    }

    let isFinalStage = false;

    // Check if stage approval requirement met
    if (currentStage.approvalsCount >= (currentStage.approvalsRequired || 1)) {
      currentStage.status = "approved";

      const hasNextStage = stageIndex + 1 < stages.length;

      if (hasNextStage) {
        workflowState.currentStageIndex = stageIndex + 1;
        const nextStage = stages[stageIndex + 1];
        nextStage.status = "in_progress";
        workflowState.currentStageId = nextStage.stageId;
        workflowState.currentStageName = nextStage.name;
        workflowState.pendingPermission = nextStage.requiredPermission;
        workflowState.status = "in_review";
      } else {
        // Final Approval reached!
        isFinalStage = true;
        workflowState.status = "approved";
        workflowState.approvedBy = req.user._id;
        workflowState.approvedAt = new Date();

        payroll.status = "approved";
        payroll.approvedBy = req.user._id;
        payroll.approvedAt = new Date();

        // Trigger Accounting Accrual
        await ensurePayrollAccrual({ payroll, userId: req.user._id });
      }
    } else {
      workflowState.status = "in_review";
      currentStage.status = "in_progress";
    }

    if (!Array.isArray(payroll.auditTrail)) payroll.auditTrail = [];
    payroll.auditTrail.push({
      action: isFinalStage ? "approved" : "stage_approved",
      performedBy: req.user._id,
      performedAt: new Date(),
      previousStatus: payroll.status,
      newStatus: payroll.status,
      reason: clean(req.body.comments) || clean(req.body.reason) || `Approved stage: ${currentStage.name}`,
      note: `Stage: ${currentStage.name} (${currentStage.approvalsCount}/${currentStage.approvalsRequired})`,
    });

    await payroll.save();

    await PayrollApprovalHistory.create({
      tenantId: payroll.tenantId || null,
      payroll: payroll._id,
      payrollPeriod: { year: payroll.year, month: payroll.month },
      cycle: workflowState.cycle || 1,
      stageId: currentStage.stageId,
      stageName: currentStage.name,
      sequence: currentStage.sequence,
      action: "approved",
      actor: req.user._id,
      actorRole: req.user.role || "employee",
      actorPermission: req.user.permissionGroup?.name || "",
      previousState: "in_review",
      resultingState: isFinalStage ? "approved" : "in_review",
      comments: clean(req.body.comments) || clean(req.body.reason) || `Approved stage ${currentStage.name}`,
      ipAddress: req.ip || "",
      userAgent: req.get("User-Agent") || "",
    });

    const full = await populatePayrollQuery(Payroll.findById(payroll._id)).lean();

    return res.json({
      message: isFinalStage
        ? "Payroll fully approved and accrued to accounting."
        : `Stage '${currentStage.name}' approved successfully.`,
      payroll: full,
      isFinalStage,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      message: "Server error in approvePayrollStage.",
      error: err.message,
    });
  }
};

/* ===============================
   SEND BACK PAYROLL
================================ */

export const sendBackPayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = clean(req.body.reason || req.body.comments);

    if (!reason) {
      return res.status(400).json({ message: "A reason is mandatory when sending back payroll." });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found." });

    if (!assertPayrollTenant(req, payroll)) {
      return res.status(403).json({ message: "Access forbidden to this payroll record." });
    }

    if (await checkPeriodLocked(payroll.year, payroll.month)) {
      return res.status(403).json({
        message: `Payroll period ${payroll.year}-${String(payroll.month).padStart(2, "0")} is locked.`,
      });
    }

    const workflowState = payroll.approvalWorkflow;
    if (!workflowState?.isWorkflowEnabled) {
      return res.status(400).json({ message: "Approval workflow is not enabled for this payroll." });
    }

    if (!["submitted", "in_review"].includes(workflowState.status)) {
      return res.status(400).json({
        message: `Cannot send back payroll with workflow status '${workflowState.status}'.`,
      });
    }

    const currentStage = workflowState.stages?.[workflowState.currentStageIndex || 0];
    if (currentStage && currentStage.allowSendBack === false) {
      return res.status(400).json({
        message: `Stage '${currentStage.name}' does not allow send-back.`,
      });
    }

    // Permission check
    if (
      currentStage &&
      !userHasWorkflowPermission(req.user, currentStage.requiredPermission)
    ) {
      return res.status(403).json({
        message: `Forbidden: Missing permission to review or send back payroll at stage '${currentStage.name}'.`,
      });
    }

    // Maker-checker rule: preparer cannot send back their own submission
    if (workflowState.enforceMakerChecker && isMaker(payroll, req.user._id)) {
      return res.status(403).json({
        message: "Maker-checker violation: Preparer cannot act as reviewer or send back their own payroll.",
      });
    }

    workflowState.status = "sent_back";
    workflowState.sentBackBy = req.user._id;
    workflowState.sentBackAt = new Date();
    workflowState.sendBackReason = reason;

    // Reset stages for next cycle
    if (Array.isArray(workflowState.stages)) {
      workflowState.stages.forEach((s) => {
        s.status = "pending";
        s.approvalsCount = 0;
        s.approvedBy = [];
      });
    }

    // Payroll status reverts to calculated so preparer can recalculate / modify
    payroll.status = "calculated";

    if (!Array.isArray(payroll.auditTrail)) payroll.auditTrail = [];
    payroll.auditTrail.push({
      action: "sent_back",
      performedBy: req.user._id,
      performedAt: new Date(),
      previousStatus: "submitted",
      newStatus: "calculated",
      reason,
      note: `Sent back at stage: ${currentStage?.name || "Unknown"}`,
    });

    await payroll.save();

    await PayrollApprovalHistory.create({
      tenantId: payroll.tenantId || null,
      payroll: payroll._id,
      payrollPeriod: { year: payroll.year, month: payroll.month },
      cycle: workflowState.cycle || 1,
      stageId: currentStage?.stageId || "",
      stageName: currentStage?.name || "",
      sequence: currentStage?.sequence || 1,
      action: "sent_back",
      actor: req.user._id,
      actorRole: req.user.role || "employee",
      actorPermission: req.user.permissionGroup?.name || "",
      previousState: "in_review",
      resultingState: "sent_back",
      comments: reason,
      ipAddress: req.ip || "",
      userAgent: req.get("User-Agent") || "",
    });

    const full = await populatePayrollQuery(Payroll.findById(payroll._id)).lean();

    return res.json({
      message: "Payroll sent back to preparer for revision.",
      payroll: full,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in sendBackPayroll.",
      error: err.message,
    });
  }
};

/* ===============================
   REJECT PAYROLL
================================ */

export const rejectPayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = clean(req.body.reason || req.body.comments);

    if (!reason) {
      return res.status(400).json({ message: "A reason is mandatory when rejecting payroll." });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found." });

    if (!assertPayrollTenant(req, payroll)) {
      return res.status(403).json({ message: "Access forbidden to this payroll record." });
    }

    if (await checkPeriodLocked(payroll.year, payroll.month)) {
      return res.status(403).json({
        message: `Payroll period ${payroll.year}-${String(payroll.month).padStart(2, "0")} is locked.`,
      });
    }

    const workflowState = payroll.approvalWorkflow;
    if (!workflowState?.isWorkflowEnabled) {
      return res.status(400).json({ message: "Approval workflow is not enabled for this payroll." });
    }

    if (!["submitted", "in_review"].includes(workflowState.status)) {
      return res.status(400).json({
        message: `Cannot reject payroll with workflow status '${workflowState.status}'.`,
      });
    }

    const currentStage = workflowState.stages?.[workflowState.currentStageIndex || 0];
    if (currentStage && currentStage.allowReject === false) {
      return res.status(400).json({
        message: `Stage '${currentStage.name}' does not allow rejection.`,
      });
    }

    // Permission check
    if (
      currentStage &&
      !userHasWorkflowPermission(req.user, currentStage.requiredPermission)
    ) {
      return res.status(403).json({
        message: `Forbidden: Missing permission to reject payroll at stage '${currentStage.name}'.`,
      });
    }

    // Maker-checker rule: preparer cannot reject their own submission
    if (workflowState.enforceMakerChecker && isMaker(payroll, req.user._id)) {
      return res.status(403).json({
        message: "Maker-checker violation: Preparer cannot reject their own payroll.",
      });
    }

    workflowState.status = "rejected";
    workflowState.rejectedBy = req.user._id;
    workflowState.rejectedAt = new Date();
    workflowState.rejectionReason = reason;

    if (currentStage) {
      currentStage.status = "rejected";
      currentStage.comments = reason;
      currentStage.actedAt = new Date();
    }

    if (!Array.isArray(payroll.auditTrail)) payroll.auditTrail = [];
    payroll.auditTrail.push({
      action: "rejected",
      performedBy: req.user._id,
      performedAt: new Date(),
      previousStatus: payroll.status,
      newStatus: payroll.status,
      reason,
      note: `Rejected at stage: ${currentStage?.name || "Unknown"}`,
    });

    await payroll.save();

    await PayrollApprovalHistory.create({
      tenantId: payroll.tenantId || null,
      payroll: payroll._id,
      payrollPeriod: { year: payroll.year, month: payroll.month },
      cycle: workflowState.cycle || 1,
      stageId: currentStage?.stageId || "",
      stageName: currentStage?.name || "",
      sequence: currentStage?.sequence || 1,
      action: "rejected",
      actor: req.user._id,
      actorRole: req.user.role || "employee",
      actorPermission: req.user.permissionGroup?.name || "",
      previousState: "in_review",
      resultingState: "rejected",
      comments: reason,
      ipAddress: req.ip || "",
      userAgent: req.get("User-Agent") || "",
    });

    const full = await populatePayrollQuery(Payroll.findById(payroll._id)).lean();

    return res.json({
      message: "Payroll has been rejected.",
      payroll: full,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in rejectPayroll.",
      error: err.message,
    });
  }
};

/* ===============================
   BULK APPROVE PAYROLL
================================ */

export const bulkApprovePayrollStage = async (req, res) => {
  try {
    const { payrollIds, comments } = req.body;
    if (!Array.isArray(payrollIds) || payrollIds.length === 0) {
      return res.status(400).json({ message: "payrollIds array is required." });
    }

    const results = { approved: 0, skipped: 0, errors: [] };

    for (const pid of payrollIds) {
      if (!isValidObjectId(pid)) continue;
      try {
        const payroll = await Payroll.findById(pid);
        if (!payroll || !assertPayrollTenant(req, payroll)) {
          results.skipped++;
          continue;
        }

        const workflowState = payroll.approvalWorkflow;
        if (!workflowState?.isWorkflowEnabled) {
          // If disabled, approve legacy
          if (payroll.status === "approved") {
            results.skipped++;
            continue;
          }
          await ensurePayrollAccrual({ payroll, userId: req.user?._id || null });
          payroll.status = "approved";
          payroll.approvedBy = req.user?._id || null;
          payroll.approvedAt = new Date();
          await payroll.save();
          results.approved++;
          continue;
        }

        if (!["submitted", "in_review"].includes(workflowState.status)) {
          results.skipped++;
          continue;
        }

        const stage = workflowState.stages?.[workflowState.currentStageIndex || 0];
        if (!stage) {
          results.skipped++;
          continue;
        }

        // Maker-checker check
        if (workflowState.enforceMakerChecker && isMaker(payroll, req.user._id)) {
          results.skipped++;
          results.errors.push({ id: pid, error: "Maker-checker violation: Preparer cannot approve." });
          continue;
        }

        // Permission check
        if (!userHasWorkflowPermission(req.user, stage.requiredPermission)) {
          results.skipped++;
          results.errors.push({ id: pid, error: `Missing required permission: ${stage.requiredPermission}` });
          continue;
        }

        // Record stage approval
        if (!Array.isArray(stage.approvedBy)) stage.approvedBy = [];
        if (!stage.approvedBy.some((uid) => String(uid) === String(req.user._id))) {
          stage.approvedBy.push(req.user._id);
          stage.approvalsCount = (stage.approvalsCount || 0) + 1;
          stage.actedAt = new Date();
          if (comments) stage.comments = clean(comments);
        }

        let isFinal = false;
        if (stage.approvalsCount >= (stage.approvalsRequired || 1)) {
          stage.status = "approved";
          const hasNext = (workflowState.currentStageIndex || 0) + 1 < (workflowState.stages?.length || 0);
          if (hasNext) {
            workflowState.currentStageIndex = (workflowState.currentStageIndex || 0) + 1;
            const nextStage = workflowState.stages[workflowState.currentStageIndex];
            nextStage.status = "in_progress";
            workflowState.currentStageId = nextStage.stageId;
            workflowState.currentStageName = nextStage.name;
            workflowState.pendingPermission = nextStage.requiredPermission;
            workflowState.status = "in_review";
          } else {
            isFinal = true;
            workflowState.status = "approved";
            workflowState.approvedBy = req.user._id;
            workflowState.approvedAt = new Date();
            payroll.status = "approved";
            payroll.approvedBy = req.user._id;
            payroll.approvedAt = new Date();
            await ensurePayrollAccrual({ payroll, userId: req.user._id });
          }
        }

        await payroll.save();

        await PayrollApprovalHistory.create({
          tenantId: payroll.tenantId || null,
          payroll: payroll._id,
          payrollPeriod: { year: payroll.year, month: payroll.month },
          cycle: workflowState.cycle || 1,
          stageId: stage.stageId,
          stageName: stage.name,
          sequence: stage.sequence,
          action: "approved",
          actor: req.user._id,
          comments: clean(comments) || `Bulk approved stage: ${stage.name}`,
        });

        results.approved++;
      } catch (err) {
        results.errors.push({ id: pid, error: err.message });
      }
    }

    return res.json({
      message: `Bulk approval finished: ${results.approved} approved, ${results.skipped} skipped.`,
      results,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in bulkApprovePayrollStage.",
      error: err.message,
    });
  }
};

/* ===============================
   APPROVAL HISTORY ENDPOINT
================================ */

export const getPayrollApprovalHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const history = await PayrollApprovalHistory.find({ payroll: id })
      .populate("actor", "name email role")
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ history });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getPayrollApprovalHistory.",
      error: err.message,
    });
  }
};

/* ===============================
   LIST APPROVALS & METRICS
================================ */

export const listPayrollApprovals = async (req, res) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const tab = clean(req.query.tab || req.query.filter || "all").toLowerCase();
    const department = clean(req.query.department);
    const search = clean(req.query.search);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const baseFilter = { year, month };
    const userTenant = req.tenantId || req.user?.tenantId;
    if (userTenant) {
      baseFilter.$or = [{ tenantId: userTenant }, { tenantId: null }];
    }
    if (department && isValidObjectId(department)) {
      baseFilter.department = department;
    }

    // Exclude cancelled and reversed
    baseFilter.status = { $nin: ["cancelled", "reversed"] };

    // Fetch all records for the period to calculate metrics
    const periodPayrolls = await Payroll.find(baseFilter)
      .populate("employee", "name email")
      .lean();

    const currentUserId = String(req.user?._id || "");
    const userPermissions =
      req.user?.permissionGroup?.isActive === false
        ? []
        : req.user?.permissionGroup?.permissions || [];
    const isGlobalAdmin = ["admin", "superadmin"].includes(req.user?.role || "");

    // Calculate metrics
    let awaitingMyReviewCount = 0;
    let pendingFinalApprovalCount = 0;
    let approvedCount = 0;
    let sentBackCount = 0;
    let totalNetPayable = 0;

    periodPayrolls.forEach((p) => {
      totalNetPayable += Number(p.netPayable || 0);

      if (p.status === "approved" || p.approvalWorkflow?.status === "approved") {
        approvedCount++;
      } else if (p.approvalWorkflow?.status === "sent_back") {
        sentBackCount++;
      }

      const wf = p.approvalWorkflow;
      if (wf?.isWorkflowEnabled && ["submitted", "in_review"].includes(wf.status)) {
        const isUserMaker = isMaker(p, currentUserId);
        const stage = wf.stages?.[wf.currentStageIndex || 0];

        // Is pending final approval?
        const isLastStage =
          (wf.currentStageIndex || 0) + 1 >= (wf.stages?.length || 1);
        if (isLastStage) {
          pendingFinalApprovalCount++;
        }

        // Is awaiting my review?
        const canReview =
          (!wf.enforceMakerChecker || !isUserMaker) &&
          (isGlobalAdmin ||
            userPermissions.includes(stage?.requiredPermission) ||
            userPermissions.includes("payroll:manage"));

        if (canReview) {
          awaitingMyReviewCount++;
        }
      }
    });

    // Build filter for paginated list based on tab
    const queryFilter = { ...baseFilter };

    if (tab === "awaiting_my_review") {
      queryFilter["approvalWorkflow.isWorkflowEnabled"] = true;
      queryFilter["approvalWorkflow.status"] = { $in: ["submitted", "in_review"] };
      if (!isGlobalAdmin) {
        queryFilter["approvalWorkflow.pendingPermission"] = {
          $in: [...userPermissions, "payroll:manage"],
        };
      }
      // If maker-checker is enforced, filter out where current user is maker
      queryFilter["approvalWorkflow.preparedBy"] = { $ne: req.user._id };
      queryFilter["approvalWorkflow.submittedBy"] = { $ne: req.user._id };
    } else if (tab === "pending_final_approval") {
      queryFilter["approvalWorkflow.isWorkflowEnabled"] = true;
      queryFilter["approvalWorkflow.status"] = { $in: ["submitted", "in_review"] };
    } else if (tab === "approved") {
      queryFilter.status = "approved";
    } else if (tab === "sent_back") {
      queryFilter["approvalWorkflow.status"] = "sent_back";
    }

    if (search) {
      // Find matching employee IDs
      const matchingEmployees = await mongoose
        .model("User")
        .find({
          name: { $regex: search, $options: "i" },
        })
        .select("_id")
        .lean();
      const empIds = matchingEmployees.map((e) => e._id);
      queryFilter.employee = { $in: empIds };
    }

    const total = await Payroll.countDocuments(queryFilter);
    const items = await populatePayrollQuery(
      Payroll.find(queryFilter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    ).lean();

    return res.json({
      items,
      total,
      page,
      limit,
      metrics: {
        totalPeriodCount: periodPayrolls.length,
        totalNetPayable: roundMoney(totalNetPayable),
        awaitingMyReview: awaitingMyReviewCount,
        pendingFinalApproval: pendingFinalApprovalCount,
        approved: approvedCount,
        sentBack: sentBackCount,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in listPayrollApprovals.",
      error: err.message,
    });
  }
};
