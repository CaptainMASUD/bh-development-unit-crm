import Customer from "../models/customer.model.js"

/* ------------------ helpers ------------------ */

const isAdminOrSuperAdmin = (userOrReq) => {
  const role = userOrReq?.user?.role ?? userOrReq?.role
  return role === "admin" || role === "superadmin"
}

const canAccess = (customer, user) => {
  if (!customer || !user) return false

  // ✅ admin/superadmin can access all customers
  if (isAdminOrSuperAdmin(user)) return true

  return (
    String(customer.assignedTo) === String(user._id) ||
    String(customer.createdBy) === String(user._id)
  )
}

const ensureReport = (customer, type) => {
  if (type === "draft") {
    if (!customer.draftReport) customer.draftReport = { files: [] }
    if (!Array.isArray(customer.draftReport.files)) customer.draftReport.files = []
    return customer.draftReport
  }
  if (type === "final") {
    if (!customer.finalReport) customer.finalReport = { files: [] }
    if (!Array.isArray(customer.finalReport.files)) customer.finalReport.files = []
    return customer.finalReport
  }
  return null
}

const normalizeFiles = (files) => {
  if (!Array.isArray(files)) return null

  const cleaned = files
    .filter(Boolean)
    .map((f) => {
      const originalName = typeof f.originalName === "string" ? f.originalName.trim() : ""
      const displayNameRaw = typeof f.displayName === "string" ? f.displayName : ""
      // ✅ default: displayName = originalName
      const displayName = (displayNameRaw || "").trim() || originalName

      return {
        key: typeof f.key === "string" ? f.key : "",
        url: typeof f.url === "string" ? f.url : "",
        originalName,
        displayName,
        mimeType: typeof f.mimeType === "string" ? f.mimeType : "",
        size: typeof f.size === "number" ? f.size : undefined,
        uploadedAt: f.uploadedAt ? new Date(f.uploadedAt) : undefined,
      }
    })

  // required: key, url, originalName
  const ok = cleaned.every((f) => f.key && f.url && f.originalName)
  if (!ok) return null

  return cleaned
}

/* ------------------ controllers ------------------ */

/**
 * ADD FILES TO DRAFT REPORT
 * PATCH /customers/:customerId/draft
 * body: { files: [{ key, url, originalName, displayName?, mimeType?, size?, uploadedAt? }] }
 */
export const updateDraftReport = async (req, res) => {
  try {
    const { files } = req.body

    const customer = await Customer.findById(req.params.customerId)
    if (!customer) return res.status(404).json({ message: "Customer not found." })

    if (!canAccess(customer, req.user)) {
      return res.status(403).json({ message: "No access to this customer." })
    }

    if (files === undefined) {
      return res.status(400).json({ message: "files is required." })
    }

    const normalized = normalizeFiles(files)
    if (!normalized) {
      return res.status(400).json({
        message: "files must be an array of { key, url, originalName, ... }",
      })
    }

    const report = ensureReport(customer, "draft")
    report.files.push(...normalized)

    await customer.save()

    return res.status(200).json({
      message: "Draft report updated.",
      draftReport: customer.draftReport,
    })
  } catch (err) {
    return res.status(500).json({
      message: "Server error in updateDraftReport.",
      error: err.message,
    })
  }
}

/**
 * ADD FILES TO FINAL REPORT
 * PATCH /customers/:customerId/final
 * body: { files: [{ key, url, originalName, displayName?, mimeType?, size?, uploadedAt? }] }
 */
export const updateFinalReport = async (req, res) => {
  try {
    const { files } = req.body

    const customer = await Customer.findById(req.params.customerId)
    if (!customer) return res.status(404).json({ message: "Customer not found." })

    if (!canAccess(customer, req.user)) {
      return res.status(403).json({ message: "No access to this customer." })
    }

    if (files === undefined) {
      return res.status(400).json({ message: "files is required." })
    }

    const normalized = normalizeFiles(files)
    if (!normalized) {
      return res.status(400).json({
        message: "files must be an array of { key, url, originalName, ... }",
      })
    }

    const report = ensureReport(customer, "final")
    report.files.push(...normalized)

    await customer.save()

    return res.status(200).json({
      message: "Final report updated.",
      finalReport: customer.finalReport,
    })
  } catch (err) {
    return res.status(500).json({
      message: "Server error in updateFinalReport.",
      error: err.message,
    })
  }
}

/**
 * REMOVE FILE FROM DRAFT/FINAL
 * DELETE /customers/:customerId/report-file
 * body: { type: "draft"|"final", key }
 */
export const removeReportFile = async (req, res) => {
  try {
    const { type, key } = req.body

    if (!type || !key) {
      return res.status(400).json({ message: "type and key are required." })
    }
    if (!["draft", "final"].includes(type)) {
      return res.status(400).json({ message: 'type must be "draft" or "final".' })
    }

    const customer = await Customer.findById(req.params.customerId)
    if (!customer) return res.status(404).json({ message: "Customer not found." })

    if (!canAccess(customer, req.user)) {
      return res.status(403).json({ message: "No access to this customer." })
    }

    const report = ensureReport(customer, type)

    const before = report.files.length
    report.files = report.files.filter((f) => f.key !== key)
    const after = report.files.length

    if (before === after) {
      return res.status(404).json({ message: "File not found for this report." })
    }

    await customer.save()

    return res.status(200).json({
      message: "Report file removed.",
      report,
    })
  } catch (err) {
    return res.status(500).json({
      message: "Server error in removeReportFile.",
      error: err.message,
    })
  }
}

/**
 * RENAME FILE (displayName only)
 * PATCH /customers/:customerId/report-file-name
 * body: { type: "draft"|"final", key, displayName }
 *
 * ✅ originalName never changes
 * ✅ if displayName is empty -> it resets to originalName
 */
export const renameReportFile = async (req, res) => {
  try {
    const { type, key, displayName } = req.body

    if (!type || !key) {
      return res.status(400).json({ message: "type and key are required." })
    }
    if (!["draft", "final"].includes(type)) {
      return res.status(400).json({ message: 'type must be "draft" or "final".' })
    }
    if (displayName !== undefined && typeof displayName !== "string") {
      return res.status(400).json({ message: "displayName must be a string." })
    }

    const customer = await Customer.findById(req.params.customerId)
    if (!customer) return res.status(404).json({ message: "Customer not found." })

    if (!canAccess(customer, req.user)) {
      return res.status(403).json({ message: "No access to this customer." })
    }

    const report = ensureReport(customer, type)
    const file = report.files.find((f) => f.key === key)

    if (!file) {
      return res.status(404).json({ message: "File not found for this report." })
    }

    const trimmed = (displayName || "").trim()
    file.displayName = trimmed || file.originalName

    await customer.save()

    return res.status(200).json({
      message: "File name updated.",
      file,
      report,
    })
  } catch (err) {
    return res.status(500).json({
      message: "Server error in renameReportFile.",
      error: err.message,
    })
  }
}
