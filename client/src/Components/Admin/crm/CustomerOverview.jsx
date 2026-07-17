"use client"

import { useCallback, useMemo, useState } from "react"
import {
  FiExternalLink,
  FiFolder,
  FiInfo,
  FiMail,
  FiMapPin,
  FiPhone,
  FiUpload,
  FiUser,
  FiUsers,
} from "react-icons/fi"
import {
  HiOutlineArchive,
  HiOutlineDocument,
  HiOutlineDocumentText,
  HiOutlinePhotograph,
  HiOutlineTable,
} from "react-icons/hi"
import { Loader2 } from "lucide-react"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const cn = (...classes) => classes.filter(Boolean).join(" ")

function getAuthHeaders() {
  const token = localStorage.getItem("token")

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function formatLabel(value) {
  const text = String(value || "").replaceAll("_", " ").trim()

  if (!text) return "Not set"

  return text
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "border-slate-200 bg-slate-50 text-slate-600",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  }

  return (
    <span
      className={cn(
        `
          inline-flex min-h-7 items-center rounded-full border
          px-2.5 py-1 text-[10px] font-extrabold
          tracking-[0.035em] whitespace-nowrap
        `,
        tones[tone] || tones.gray
      )}
    >
      {children}
    </span>
  )
}

function SectionCard({
  title,
  icon,
  right,
  children,
  className,
  bodyClassName,
}) {
  return (
    <section
      className={cn(
        `
          overflow-hidden rounded-2xl border border-slate-200/80
          bg-white shadow-[0_14px_36px_-30px_rgba(15,23,42,0.34)]
        `,
        className
      )}
    >
      <header
        className="
          flex flex-col gap-3 border-b border-slate-100
          px-4 py-3.5
          sm:flex-row sm:items-center sm:justify-between
          sm:px-5 sm:py-4
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="
              flex h-9 w-9 shrink-0 items-center justify-center
              rounded-xl border border-indigo-100
              bg-indigo-50 text-indigo-600
            "
          >
            {icon}
          </span>

          <h2
            className="
              min-w-0 truncate text-sm font-extrabold
              tracking-[-0.015em] text-slate-900
              sm:text-[15px]
            "
          >
            {title}
          </h2>
        </div>

        {right ? (
          <div
            className="
              flex w-full flex-wrap items-center gap-2
              sm:w-auto sm:justify-end
            "
          >
            {right}
          </div>
        ) : null}
      </header>

      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

function MetricCard({ label, value, icon, tone = "indigo" }) {
  const tones = {
    indigo: "border-indigo-100 bg-indigo-50/70 text-indigo-700",
    amber: "border-amber-100 bg-amber-50/70 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-700",
    gray: "border-slate-200 bg-slate-50 text-slate-700",
  }

  return (
    <div
      className={cn(
        `
          flex min-w-0 items-center gap-3 rounded-xl
          border p-3.5
        `,
        tones[tone] || tones.gray
      )}
    >
      <span
        className="
          flex h-9 w-9 shrink-0 items-center justify-center
          rounded-xl border border-white/80 bg-white/80
          text-current shadow-sm
        "
      >
        {icon}
      </span>

      <span className="min-w-0">
        <span
          className="
            block text-[10px] font-bold uppercase
            tracking-[0.055em] text-slate-500
          "
        >
          {label}
        </span>

        <span
          className="
            mt-0.5 block text-xl font-black
            tracking-[-0.035em] text-slate-900
          "
        >
          {value}
        </span>
      </span>
    </div>
  )
}

function InfoItem({ label, value, icon, href }) {
  const content = (
    <>
      <span
        className="
          flex h-9 w-9 shrink-0 items-center justify-center
          rounded-xl border border-slate-200
          bg-white text-slate-500 shadow-sm
        "
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className="
            block text-[10px] font-bold uppercase
            tracking-[0.055em] text-slate-400
          "
        >
          {label}
        </span>

        <span
          className="
            mt-1 block break-words text-sm
            font-semibold leading-5 text-slate-900
          "
        >
          {value || "Not set"}
        </span>
      </span>

      {href ? (
        <FiExternalLink
          className="
            h-4 w-4 shrink-0 text-slate-400
            transition group-hover:text-indigo-600
          "
          aria-hidden="true"
        />
      ) : null}
    </>
  )

  const className = `
    group flex min-h-[72px] items-start gap-3
    rounded-xl border border-slate-200/80
    bg-slate-50/55 p-3.5
    transition duration-200
    hover:border-slate-300 hover:bg-white
  `

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
        className={className}
      >
        {content}
      </a>
    )
  }

  return <div className={className}>{content}</div>
}

function ContactItem({ label, value, icon, href }) {
  const content = (
    <>
      <span
        className="
          flex h-9 w-9 shrink-0 items-center justify-center
          rounded-xl bg-slate-100 text-slate-600
        "
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-slate-500">
          {label}
        </span>

        <span
          className="
            mt-0.5 block break-words text-sm
            font-semibold leading-5 text-slate-900
          "
        >
          {value || "Not set"}
        </span>
      </span>
    </>
  )

  const className = `
    flex min-h-[68px] items-center gap-3
    rounded-xl border border-slate-200/80
    bg-white p-3.5 transition duration-200
    hover:border-indigo-200 hover:bg-indigo-50/30
  `

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    )
  }

  return <div className={className}>{content}</div>
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ""

  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDateTime(value) {
  if (!value) return "Date unavailable"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "Date unavailable"

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function fileIcon(mimeType = "", name = "") {
  const normalizedName = String(name || "").toLowerCase()
  const normalizedMime = String(mimeType || "").toLowerCase()

  const isPdf =
    normalizedMime.includes("pdf") ||
    normalizedName.endsWith(".pdf")

  if (isPdf) return <HiOutlineDocumentText className="h-5 w-5" />

  const isWord =
    normalizedMime.includes("msword") ||
    normalizedMime.includes("officedocument.wordprocessingml") ||
    normalizedName.endsWith(".doc") ||
    normalizedName.endsWith(".docx")

  if (isWord) return <HiOutlineDocument className="h-5 w-5" />

  const isExcel =
    normalizedMime.includes("ms-excel") ||
    normalizedMime.includes("officedocument.spreadsheetml") ||
    normalizedName.endsWith(".xls") ||
    normalizedName.endsWith(".xlsx") ||
    normalizedName.endsWith(".csv")

  if (isExcel) return <HiOutlineTable className="h-5 w-5" />

  const isImage =
    normalizedMime.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".webp", ".gif"].some((extension) =>
      normalizedName.endsWith(extension)
    )

  if (isImage) return <HiOutlinePhotograph className="h-5 w-5" />

  const isArchive =
    normalizedMime.includes("zip") ||
    normalizedMime.includes("rar") ||
    normalizedMime.includes("7z") ||
    [".zip", ".rar", ".7z"].some((extension) =>
      normalizedName.endsWith(extension)
    )

  if (isArchive) return <HiOutlineArchive className="h-5 w-5" />

  return <HiOutlineDocument className="h-5 w-5" />
}

function normalizeRole(role) {
  return String(role || "").toLowerCase() === "employee"
    ? "employee"
    : "admin"
}

function roleLabel(role) {
  return normalizeRole(role) === "employee" ? "Employee" : "Admin"
}

function roleBadgeTone(role) {
  return normalizeRole(role) === "employee" ? "amber" : "indigo"
}

async function presignUploadForCustomer({ file, customerId }) {
  const response = await fetch(`${API_BASE}/upload/presign`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      customerId,
      taskId: "customer-files",
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.message || "Failed to prepare upload")
  }

  return data
}

async function putToS3({ uploadUrl, file }) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error("File upload failed")
  }
}

async function patchCustomerFiles({ customerId, customerFiles }) {
  const response = await fetch(`${API_BASE}/customers/${customerId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ customerFiles }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.message || "Failed to update customer files")
  }

  return data
}

function LoadingState() {
  return (
    <div
      className="
        grid animate-pulse grid-cols-1 gap-4
        xl:grid-cols-12
      "
    >
      <div
        className="
          h-64 rounded-2xl border border-slate-200
          bg-white xl:col-span-4
        "
      />

      <div
        className="
          h-[420px] rounded-2xl border border-slate-200
          bg-white xl:col-span-8
        "
      />

      <div
        className="
          h-72 rounded-2xl border border-slate-200
          bg-white xl:col-span-4
        "
      />

      <div
        className="
          h-56 rounded-2xl border border-slate-200
          bg-white xl:col-span-12
        "
      />
    </div>
  )
}

export default function CustomerOverview({
  customer,
  loading,
  customerId,
  onSoftRefreshCustomer,
  setPageError,
  showToast,
  canManageCustomerFiles,
}) {
  const [uploading, setUploading] = useState(false)

  const assignedTo = Array.isArray(customer?.assignedTo)
    ? customer.assignedTo
    : []

  const assignedNames = assignedTo
    .map((user) =>
      typeof user === "string"
        ? user
        : user?.name || user?.email || "Employee"
    )
    .filter(Boolean)

  const customerFiles = Array.isArray(customer?.customerFiles)
    ? customer.customerFiles
    : []

  const latestEngagement = useMemo(() => {
    const engagements = Array.isArray(customer?.engagements)
      ? customer.engagements
      : []

    if (!engagements.length) return null

    return (
      engagements
        .slice()
        .sort(
          (first, second) =>
            Number(second?.year || 0) - Number(first?.year || 0)
        )[0] || null
    )
  }, [customer])

  const engagementYear = latestEngagement?.year || null

  const engagementTitle = useMemo(() => {
    if (!latestEngagement) return ""

    const title = String(
      latestEngagement?.engagementTitle || ""
    ).trim()

    if (title) return title

    return latestEngagement?.engagementTemplateId
      ? String(latestEngagement.engagementTemplateId)
      : ""
  }, [latestEngagement])

  const subEngagementTexts = useMemo(() => {
    const subEngagements = Array.isArray(
      latestEngagement?.subEngagements
    )
      ? latestEngagement.subEngagements
      : []

    return subEngagements
      .map((item) => String(item?.text || "").trim())
      .filter(Boolean)
  }, [latestEngagement])

  const inferActorRole = useCallback(
    (uploadedBy) => {
      const uploadedById = String(uploadedBy || "")

      if (!uploadedById) return "admin"

      const assignedIds = assignedTo
        .map((user) => String(user?._id || user))
        .filter(Boolean)

      return assignedIds.includes(uploadedById)
        ? "employee"
        : "admin"
    },
    [assignedTo]
  )

  const fileStats = useMemo(() => {
    const counts = {
      admin: 0,
      employee: 0,
    }

    customerFiles.forEach((file) => {
      const role = normalizeRole(inferActorRole(file?.uploadedBy))
      counts[role] += 1
    })

    return counts
  }, [customerFiles, inferActorRole])

  const sortedFiles = useMemo(() => {
    return customerFiles.slice().sort((first, second) => {
      const firstTime = first?.uploadedAt
        ? new Date(first.uploadedAt).getTime()
        : 0

      const secondTime = second?.uploadedAt
        ? new Date(second.uploadedAt).getTime()
        : 0

      return secondTime - firstTime
    })
  }, [customerFiles])

  const uploadPermanentFiles = useCallback(
    async (fileList) => {
      if (!customerId || !fileList?.length) return
      if (!canManageCustomerFiles || uploading) return

      setPageError?.("")
      setUploading(true)

      try {
        const uploadedFiles = []

        for (const file of fileList) {
          const presigned = await presignUploadForCustomer({
            file,
            customerId,
          })

          await putToS3({
            uploadUrl: presigned.uploadUrl,
            file,
          })

          uploadedFiles.push({
            key: presigned.key,
            url: presigned.url || "",
            originalName: file.name,
            displayName: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          })
        }

        await patchCustomerFiles({
          customerId,
          customerFiles: [...customerFiles, ...uploadedFiles],
        })

        await onSoftRefreshCustomer?.()
        showToast?.("Files uploaded successfully")
      } catch (error) {
        setPageError?.(error?.message || "Upload failed.")
      } finally {
        setUploading(false)
      }
    },
    [
      canManageCustomerFiles,
      customerFiles,
      customerId,
      onSoftRefreshCustomer,
      setPageError,
      showToast,
      uploading,
    ]
  )

  const renderFileRow = useCallback(
    (file, index) => {
      const displayName =
        String(file?.displayName || "").trim() ||
        file?.originalName ||
        file?.key ||
        "Untitled file"

      const role = inferActorRole(file?.uploadedBy)

      return (
        <article
          key={`${String(file?._id || file?.key)}-${index}`}
          className="
            flex flex-col gap-3 rounded-xl
            border border-slate-200/80 bg-white
            p-3.5 transition duration-200
            hover:border-slate-300
            sm:flex-row sm:items-center sm:justify-between
          "
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="
                flex h-10 w-10 shrink-0 items-center justify-center
                rounded-xl border border-slate-200
                bg-slate-50 text-slate-600
              "
            >
              {fileIcon(file?.mimeType, file?.originalName)}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3
                  className="
                    min-w-0 max-w-full truncate
                    text-sm font-extrabold text-slate-900
                  "
                  title={displayName}
                >
                  {displayName}
                </h3>

                <Badge tone={roleBadgeTone(role)}>
                  {roleLabel(role)}
                </Badge>
              </div>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {file?.size
                  ? `${formatBytes(Number(file.size) || 0)} · `
                  : ""}
                {formatDateTime(file?.uploadedAt)}
              </p>
            </div>
          </div>

          {file?.url ? (
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="
                inline-flex min-h-10 w-full items-center
                justify-center gap-2 rounded-xl border
                border-slate-200 bg-white px-3
                text-sm font-bold text-slate-700
                transition duration-200
                hover:border-indigo-200 hover:bg-indigo-50
                hover:text-indigo-700
                focus:outline-none focus-visible:ring-4
                focus-visible:ring-indigo-100
                sm:w-auto
              "
            >
              <FiExternalLink className="h-4 w-4" />
              View
            </a>
          ) : null}
        </article>
      )
    },
    [inferActorRole]
  )

  if (loading) {
    return <LoadingState />
  }

  if (!customer) {
    return (
      <div
        className="
          rounded-2xl border border-dashed border-slate-300
          bg-white px-6 py-14 text-center
        "
      >
        <p className="text-sm font-bold text-slate-700">
          Customer information is unavailable.
        </p>
      </div>
    )
  }

  const emailHref = customer?.email
    ? `mailto:${customer.email}`
    : ""

  const phoneHref = customer?.phone
    ? `tel:${customer.phone}`
    : ""

  const mapHref = customer?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        customer.address
      )}`
    : ""

  const contactPerson = customer?.contactPerson || {}

  const contactName = contactPerson?.name || ""
  const contactPhone = contactPerson?.phone || ""
  const contactEmail = contactPerson?.email || ""
  const contactDesignation = contactPerson?.designation || ""

  const contactPhoneHref = contactPhone
    ? `tel:${contactPhone}`
    : ""

  const contactEmailHref = contactEmail
    ? `mailto:${contactEmail}`
    : ""

  const hasContactPerson = Boolean(
    contactName ||
      contactPhone ||
      contactEmail ||
      contactDesignation
  )

  return (
    <div
      className="
        grid grid-cols-1 gap-4
        md:gap-5 xl:grid-cols-12
      "
    >
      <div className="xl:col-span-4">
        <SectionCard
          title="Overview"
          icon={<FiUser className="h-[18px] w-[18px]" />}
          right={
            <>
              <Badge tone="indigo">
                {formatLabel(customer?.status)}
              </Badge>

              {customer?.customerType ? (
                <Badge tone="amber">
                  {formatLabel(customer.customerType)}
                </Badge>
              ) : null}
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Assigned"
              value={assignedNames.length}
              icon={<FiUsers className="h-4 w-4" />}
              tone="indigo"
            />

            <MetricCard
              label="Files"
              value={customerFiles.length}
              icon={<FiFolder className="h-4 w-4" />}
              tone="amber"
            />
          </div>

          <div
            className="
              mt-4 rounded-xl border border-slate-200/80
              bg-slate-50/55 p-4
            "
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className="
                    text-[10px] font-bold uppercase
                    tracking-[0.055em] text-slate-400
                  "
                >
                  Latest Engagement
                </p>

                <p
                  className="
                    mt-1.5 truncate text-sm
                    font-extrabold text-slate-900
                  "
                  title={engagementTitle}
                >
                  {engagementTitle || "No engagement added"}
                </p>
              </div>

              {engagementYear ? (
                <Badge tone="amber">{engagementYear}</Badge>
              ) : null}
            </div>

            {subEngagementTexts.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {subEngagementTexts.map((text, index) => (
                  <span
                    key={`${text}-${index}`}
                    className="
                      inline-flex max-w-full items-center
                      truncate rounded-full border
                      border-slate-200 bg-white
                      px-2.5 py-1 text-[10px]
                      font-bold text-slate-600
                    "
                    title={text}
                  >
                    {text}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="xl:col-span-8 xl:row-span-2">
        <SectionCard
          title="Customer Details"
          icon={<FiInfo className="h-[18px] w-[18px]" />}
          right={
            assignedNames.length ? (
              <Badge tone="indigo">
                {assignedNames.length} Assigned
              </Badge>
            ) : null
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoItem
              label="Customer Name"
              value={customer?.name}
              icon={<FiUser className="h-4 w-4" />}
            />

            <InfoItem
              label="Company"
              value={customer?.companyName}
              icon={<FiInfo className="h-4 w-4" />}
            />

            <InfoItem
              label="Email"
              value={customer?.email}
              icon={<FiMail className="h-4 w-4" />}
              href={emailHref || undefined}
            />

            <InfoItem
              label="Phone"
              value={customer?.phone}
              icon={<FiPhone className="h-4 w-4" />}
              href={phoneHref || undefined}
            />
          </div>

          <div
            className="
              mt-3 grid grid-cols-1 gap-3
              lg:grid-cols-2
            "
          >
            <InfoItem
              label="Assigned Team"
              value={
                assignedNames.length
                  ? assignedNames.join(", ")
                  : "Not assigned"
              }
              icon={<FiUsers className="h-4 w-4" />}
            />

            <InfoItem
              label="Address"
              value={customer?.address}
              icon={<FiMapPin className="h-4 w-4" />}
              href={mapHref || undefined}
            />
          </div>
        </SectionCard>
      </div>

      <div className="xl:col-span-4">
        <SectionCard
          title="Contact Person"
          icon={<FiUsers className="h-[18px] w-[18px]" />}
          right={
            <Badge tone={hasContactPerson ? "emerald" : "gray"}>
              {hasContactPerson ? "Available" : "Not Set"}
            </Badge>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <ContactItem
              label="Name"
              value={contactName}
              icon={<FiUser className="h-4 w-4" />}
            />

            <ContactItem
              label="Designation"
              value={contactDesignation}
              icon={<FiInfo className="h-4 w-4" />}
            />

            <ContactItem
              label="Phone"
              value={contactPhone}
              icon={<FiPhone className="h-4 w-4" />}
              href={contactPhoneHref || undefined}
            />

            <ContactItem
              label="Email"
              value={contactEmail}
              icon={<FiMail className="h-4 w-4" />}
              href={contactEmailHref || undefined}
            />
          </div>
        </SectionCard>
      </div>

      <div className="xl:col-span-12">
        <SectionCard
          title="Files"
          icon={<FiFolder className="h-[18px] w-[18px]" />}
          right={
            <>
              {fileStats.admin > 0 ? (
                <Badge tone="indigo">
                  {fileStats.admin} Admin
                </Badge>
              ) : null}

              {fileStats.employee > 0 ? (
                <Badge tone="amber">
                  {fileStats.employee} Employee
                </Badge>
              ) : null}

              <label
                className={cn(
                  `
                    inline-flex min-h-10 w-full items-center
                    justify-center gap-2 rounded-xl px-4
                    text-sm font-extrabold transition duration-200
                    sm:w-auto
                  `,
                  canManageCustomerFiles
                    ? `
                        cursor-pointer bg-indigo-600 text-white
                        hover:bg-indigo-700
                        focus-within:ring-4
                        focus-within:ring-indigo-100
                      `
                    : `
                        cursor-not-allowed bg-slate-200
                        text-slate-500
                      `,
                  uploading && "pointer-events-none opacity-70"
                )}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FiUpload className="h-4 w-4" />
                )}

                <span>{uploading ? "Uploading" : "Upload Files"}</span>

                <input
                  type="file"
                  hidden
                  multiple
                  disabled={
                    uploading || !canManageCustomerFiles
                  }
                  onChange={(event) => {
                    const files = Array.from(
                      event.target.files || []
                    )

                    event.target.value = ""

                    if (files.length) {
                      uploadPermanentFiles(files)
                    }
                  }}
                />
              </label>
            </>
          }
        >
          {sortedFiles.length ? (
            <div className="space-y-2.5">
              {sortedFiles.map((file, index) =>
                renderFileRow(file, index)
              )}
            </div>
          ) : (
            <div
              className="
                flex min-h-36 flex-col items-center
                justify-center rounded-xl border
                border-dashed border-slate-300
                bg-slate-50 px-5 text-center
              "
            >
              <FiFolder className="h-6 w-6 text-slate-400" />

              <p className="mt-2 text-sm font-bold text-slate-700">
                No files uploaded
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
