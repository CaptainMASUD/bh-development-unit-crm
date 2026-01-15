"use client"

import { useMemo, useState, useCallback } from "react"
import {
  FiExternalLink,
  FiFolder,
  FiUser,
  FiCheckCircle,
  FiMail,
  FiPhone,
  FiInfo,
  FiMapPin,
  FiUsers,
} from "react-icons/fi"
import {
  HiOutlineArchive,
  HiOutlineDocument,
  HiOutlineDocumentText,
  HiOutlinePhotograph,
  HiOutlineTable,
} from "react-icons/hi"

const cn = (...c) => c.filter(Boolean).join(" ")

function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  }
  const cls = tones[tone] || tones.gray
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide border",
        cls
      )}
    >
      {children}
    </span>
  )
}

function SectionCard({ title, icon, subtitle = "Overview section", right, children }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-[0_18px_60px_-45px_rgba(0,0,0,0.55)] overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900 truncate">{title}</p>
            <p className="text-xs text-gray-500 truncate">{subtitle}</p>
          </div>
        </div>
        <div className="shrink-0">{right}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function StatTile({ label, value, tone = "gray", icon }) {
  const tones = {
    gray: "bg-gray-50 border-gray-100 text-gray-900",
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-900",
    amber: "bg-amber-50 border-amber-100 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-900",
  }
  const cls = tones[tone] || tones.gray
  return (
    <div className={cn("rounded-2xl border p-4 flex items-center justify-between gap-3", cls)}>
      <div className="min-w-0">
        <p className="text-xs font-extrabold text-gray-500">{label}</p>
        <p className="mt-1 text-xl font-extrabold">{value}</p>
      </div>
      {icon ? (
        <div className="w-10 h-10 rounded-2xl bg-white/60 border border-gray-200 flex items-center justify-center text-gray-700 shrink-0">
          {icon}
        </div>
      ) : null}
    </div>
  )
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ""
  const units = ["B", "KB", "MB", "GB"]
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDateTime(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

function fileIcon(mimeType = "", name = "") {
  const n = (name || "").toLowerCase()
  const m = (mimeType || "").toLowerCase()

  const isPdf = m.includes("pdf") || n.endsWith(".pdf")
  if (isPdf) return <HiOutlineDocumentText className="w-5 h-5" />

  const isWord =
    m.includes("msword") ||
    m.includes("officedocument.wordprocessingml") ||
    n.endsWith(".doc") ||
    n.endsWith(".docx")
  if (isWord) return <HiOutlineDocument className="w-5 h-5" />

  const isExcel =
    m.includes("ms-excel") ||
    m.includes("officedocument.spreadsheetml") ||
    n.endsWith(".xls") ||
    n.endsWith(".xlsx") ||
    n.endsWith(".csv")
  if (isExcel) return <HiOutlineTable className="w-5 h-5" />

  const isImage =
    m.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif"].some((x) => n.endsWith(x))
  if (isImage) return <HiOutlinePhotograph className="w-5 h-5" />

  const isZip =
    m.includes("zip") ||
    m.includes("rar") ||
    m.includes("7z") ||
    [".zip", ".rar", ".7z"].some((x) => n.endsWith(x))
  if (isZip) return <HiOutlineArchive className="w-5 h-5" />

  return <HiOutlineDocument className="w-5 h-5" />
}

function roleBadgeClasses(role) {
  const r = String(role || "").toLowerCase()
  if (r === "employee") return "bg-amber-500 text-white border border-amber-500"
  return "bg-indigo-600 text-white border border-indigo-600"
}

function roleLabel(role) {
  const r = String(role || "").toLowerCase()
  return r === "employee" ? "EMPLOYEE" : "ADMIN"
}

function normalizeRole(role) {
  const r = String(role || "").toLowerCase()
  return r === "employee" ? "employee" : "admin"
}

function FieldGrid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
}

function FieldItem({ label, value, icon, href }) {
  const inner = (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 hover:bg-gray-50/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700 shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-gray-500">{label}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 break-words">{value || "—"}</p>
        </div>
        {href ? (
          <span className="shrink-0 inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border border-gray-200 bg-white text-xs font-extrabold text-gray-700">
            <FiExternalLink className="w-3.5 h-3.5" />
            Open
          </span>
        ) : null}
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {inner}
      </a>
    )
  }
  return inner
}

export default function CustomerOverview({ customer, loading }) {
  const assignedTo = Array.isArray(customer?.assignedTo) ? customer.assignedTo : []
  const assignedNames = assignedTo
    .map((u) => (typeof u === "string" ? u : u?.name || u?.email || "Employee"))
    .filter(Boolean)

  const customerFiles = Array.isArray(customer?.customerFiles) ? customer.customerFiles : []

  const latestEngagement = useMemo(() => {
    const arr = Array.isArray(customer?.engagements) ? customer.engagements : []
    if (!arr.length) return null
    const sorted = arr.slice().sort((a, b) => Number(b?.year || 0) - Number(a?.year || 0))
    return sorted[0] || null
  }, [customer])

  const engagementYear = latestEngagement?.year || null

  const engagementTitle = useMemo(() => {
    if (!latestEngagement) return ""
    const t = String(latestEngagement?.engagementTitle || "").trim()
    if (t) return t
    return latestEngagement?.engagementTemplateId ? String(latestEngagement.engagementTemplateId) : ""
  }, [latestEngagement])

  const subEngagementTexts = useMemo(() => {
    const arr = Array.isArray(latestEngagement?.subEngagements) ? latestEngagement.subEngagements : []
    return arr.map((x) => String(x?.text || "").trim()).filter(Boolean)
  }, [latestEngagement])

  const inferActorRole = useCallback(
    (uploadedBy) => {
      const uid = String(uploadedBy || "")
      if (!uid) return "admin"
      const assignedIds = assignedTo.map((x) => String(x?._id || x)).filter(Boolean)
      if (assignedIds.includes(uid)) return "employee"
      return "admin"
    },
    [assignedTo]
  )

  const fileStats = useMemo(() => {
    const counts = { admin: 0, employee: 0 }
    for (const f of customerFiles) {
      const r = normalizeRole(inferActorRole(f?.uploadedBy))
      counts[r] = (counts[r] || 0) + 1
    }
    return counts
  }, [customerFiles, inferActorRole])

  const sortedFiles = useMemo(() => {
    const list = customerFiles.slice()
    list.sort((a, b) => {
      const ra = normalizeRole(inferActorRole(a?.uploadedBy))
      const rb = normalizeRole(inferActorRole(b?.uploadedBy))
      const wa = ra === "admin" ? 0 : 1
      const wb = rb === "admin" ? 0 : 1
      if (wa !== wb) return wa - wb

      const ta = a?.uploadedAt ? new Date(a.uploadedAt).getTime() : 0
      const tb = b?.uploadedAt ? new Date(b.uploadedAt).getTime() : 0
      return tb - ta
    })
    return list
  }, [customerFiles, inferActorRole])

  const renderFileRow = useCallback(
    (f, idx) => {
      const shown = (f.displayName || "").trim() || f.originalName || f.key
      const role = inferActorRole(f?.uploadedBy)
      const isEmp = String(role).toLowerCase() === "employee"
      const isAdmin = !isEmp

      const rowClass = isAdmin ? "border-indigo-200 bg-indigo-50/60" : "border-amber-200 bg-amber-50/60"
      const leftBar = isAdmin ? "bg-indigo-600" : "bg-amber-500"
      const iconBox = isAdmin
        ? "bg-indigo-100 border-indigo-200 text-indigo-800"
        : "bg-amber-100 border-amber-200 text-amber-800"

      return (
        <div
          key={`${String(f?._id || f.key)}-${idx}`}
          className={cn(
            "relative p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 overflow-hidden",
            rowClass
          )}
        >
          <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 pointer-events-none", leftBar)} />

          <div className="flex items-center gap-3 min-w-0 pl-2">
            <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center shrink-0", iconBox)}>
              {fileIcon(f.mimeType, f.originalName)}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-extrabold text-gray-900 truncate">
                {shown}
                <span
                  className={cn(
                    "ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide border",
                    roleBadgeClasses(role)
                  )}
                >
                  {roleLabel(role)}
                </span>
              </p>

              <p className="text-xs text-gray-600">
                {f.size ? `${formatBytes(Number(f.size) || 0)} • ` : ""}
                {f.uploadedAt ? formatDateTime(f.uploadedAt) : "—"}
              </p>
            </div>
          </div>

          {f.url ? (
            <a
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
            >
              <FiExternalLink className="w-4 h-4" />
              Open
            </a>
          ) : (
            <span className="text-xs text-gray-500">No link</span>
          )}
        </div>
      )
    },
    [inferActorRole]
  )

  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-72 bg-gray-200 rounded" />
          <div className="h-4 w-56 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!customer) return <div className="p-8 text-center text-gray-500">No customer data found.</div>

  const emailHref = customer?.email ? `mailto:${customer.email}` : ""
  const phoneHref = customer?.phone ? `tel:${customer.phone}` : ""
  const mapHref = customer?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`
    : ""

  const cpName = customer?.contactPerson?.name || "—"
  const cpPhone = customer?.contactPerson?.phone || "—"
  const cpEmail = customer?.contactPerson?.email || "—"
  const cpDesignation = customer?.contactPerson?.designation || "—"
  const cpPhoneHref = customer?.contactPerson?.phone ? `tel:${customer.contactPerson.phone}` : ""
  const cpEmailHref = customer?.contactPerson?.email ? `mailto:${customer.contactPerson.email}` : ""

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      {/* LEFT COLUMN */}
      <div className="xl:col-span-4 space-y-4">
        <SectionCard
          title="Profile Summary"
          subtitle="Quick stats + engagement"
          icon={<FiUser className="w-5 h-5" />}
          right={
            <div className="flex items-center gap-2">
              <Badge tone="indigo">{String(customer?.status || "—").replaceAll("_", " ").toUpperCase()}</Badge>
              {customer?.customerType ? <Badge tone="amber">{String(customer.customerType).toUpperCase()}</Badge> : null}
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Assigned Employees" value={assignedNames.length || 0} tone="indigo" icon={<FiUsers />} />
              <StatTile label="Total Files" value={customerFiles.length || 0} tone="amber" icon={<FiFolder />} />
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-xs font-extrabold text-gray-500">Engagement</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {engagementYear ? <Badge tone="amber">YEAR {engagementYear}</Badge> : <Badge>YEAR —</Badge>}
                {engagementTitle ? <Badge tone="indigo">{engagementTitle}</Badge> : <Badge>TYPE —</Badge>}
              </div>

              {subEngagementTexts.length ? (
                <div className="mt-3">
                  <p className="text-xs font-extrabold text-gray-500 mb-2">Sub engagements</p>
                  <div className="flex flex-wrap gap-2">
                    {subEngagementTexts.map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-gray-50 text-gray-700 border border-gray-200"
                        title={t}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-gray-500">No sub engagements.</p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* CONTACT PERSON DETAILS (same validation design rows) */}
        <SectionCard
          title="Contact Person Details"
          subtitle="Primary contact person information"
          icon={<FiCheckCircle className="w-5 h-5" />}
          right={<Badge tone={cpName !== "—" ? "emerald" : "rose"}>{cpName !== "—" ? "SET" : "MISSING"}</Badge>}
        >
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700">
                  <FiUser />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Name</p>
                  <p className="text-xs text-gray-500 break-words">{cpName}</p>
                </div>
              </div>
              <Badge tone={cpName !== "—" ? "emerald" : "rose"}>{cpName !== "—" ? "OK" : "MISSING"}</Badge>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700">
                  <FiInfo />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Designation</p>
                  <p className="text-xs text-gray-500 break-words">{cpDesignation}</p>
                </div>
              </div>
              <Badge tone={cpDesignation !== "—" ? "emerald" : "rose"}>{cpDesignation !== "—" ? "OK" : "MISSING"}</Badge>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700">
                  <FiPhone />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Phone</p>
                  {cpPhoneHref ? (
                    <a href={cpPhoneHref} className="text-xs text-gray-500 hover:underline break-words">
                      {cpPhone}
                    </a>
                  ) : (
                    <p className="text-xs text-gray-500 break-words">{cpPhone}</p>
                  )}
                </div>
              </div>
              <Badge tone={cpPhone !== "—" ? "emerald" : "rose"}>{cpPhone !== "—" ? "OK" : "MISSING"}</Badge>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700">
                  <FiMail />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Email</p>
                  {cpEmailHref ? (
                    <a href={cpEmailHref} className="text-xs text-gray-500 hover:underline break-all">
                      {cpEmail}
                    </a>
                  ) : (
                    <p className="text-xs text-gray-500 break-all">{cpEmail}</p>
                  )}
                </div>
              </div>
              <Badge tone={cpEmail !== "—" ? "emerald" : "rose"}>{cpEmail !== "—" ? "OK" : "MISSING"}</Badge>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* RIGHT COLUMN */}
      <div className="xl:col-span-8 space-y-4">
        <SectionCard
          title="Customer Details"
          subtitle="Structured customer information"
          icon={<FiInfo className="w-5 h-5" />}
          right={
            assignedNames.length ? <Badge tone="indigo">ASSIGNED {assignedNames.length}</Badge> : <Badge>ASSIGNED —</Badge>
          }
        >
          <div className="space-y-5">
            <div>
              <p className="text-xs font-extrabold text-gray-500 mb-3">Identity</p>
              <FieldGrid>
                <FieldItem label="Customer Name" value={customer?.name || "—"} icon={<FiUser />} />
                <FieldItem label="Company Name" value={customer?.companyName || "—"} icon={<FiInfo />} />
              </FieldGrid>
            </div>

            <div>
              <p className="text-xs font-extrabold text-gray-500 mb-3">Status & Type</p>
              <FieldGrid>
                <FieldItem label="Status" value={customer?.status || "—"} icon={<FiInfo />} />
                <FieldItem label="Customer Type" value={customer?.customerType || "—"} icon={<FiInfo />} />
              </FieldGrid>
            </div>

            <div>
              <p className="text-xs font-extrabold text-gray-500 mb-3">Assignment</p>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-extrabold text-gray-500">Assigned To</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {assignedNames.length ? assignedNames.join(", ") : "—"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-extrabold text-gray-500 mb-3">Customer Contact</p>
              <FieldGrid>
                <FieldItem label="Email" value={customer?.email || "—"} icon={<FiMail />} href={emailHref || undefined} />
                <FieldItem label="Phone" value={customer?.phone || "—"} icon={<FiPhone />} href={phoneHref || undefined} />
              </FieldGrid>
            </div>

            <div>
              <p className="text-xs font-extrabold text-gray-500 mb-3">Address</p>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-extrabold text-gray-500">Full Address</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 break-words">{customer?.address || "—"}</p>
                {mapHref ? (
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
                  >
                    <FiExternalLink className="w-4 h-4" />
                    Open in Maps
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* FILES (view only, upload removed) */}
        <SectionCard
          title="Customer Permanent Files"
          subtitle="Stored in customerFiles"
          icon={<FiFolder className="w-5 h-5" />}
          right={
            <div className="flex flex-wrap items-center gap-2">
              {fileStats.admin ? <Badge tone="indigo">ADMIN {fileStats.admin}</Badge> : null}
              {fileStats.employee ? <Badge tone="amber">EMPLOYEE {fileStats.employee}</Badge> : null}
            </div>
          }
        >
          {sortedFiles.length ? (
            <div className="space-y-2">{sortedFiles.map((f, idx) => renderFileRow(f, idx))}</div>
          ) : (
            <div className="p-10 rounded-2xl border border-gray-100 bg-gray-50 text-sm text-gray-500 text-center">
              No permanent files uploaded for this customer.
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
