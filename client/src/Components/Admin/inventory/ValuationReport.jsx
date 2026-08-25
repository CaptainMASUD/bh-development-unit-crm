import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowDataTransferHorizontalIcon,
  DashboardSquare01Icon,
  Package01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const CARD =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.22)]"

const SOFT =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_42px_-24px_rgba(0,0,0,0.28)]"

const BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"

const GHOST_BUTTON =
  "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"

const TONES = {
  indigo: {
    badge: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    glow: "shadow-[0_18px_50px_-30px_rgba(79,70,229,0.40)]",
  },
  amber: {
    badge: "bg-amber-50 text-amber-800 ring-amber-600/10",
    glow: "shadow-[0_18px_50px_-30px_rgba(245,158,11,0.35)]",
  },
  green: {
    badge: "bg-green-50 text-green-700 ring-green-600/10",
    glow: "shadow-[0_18px_50px_-30px_rgba(34,197,94,0.35)]",
  },
  sky: {
    badge: "bg-sky-50 text-sky-700 ring-sky-600/10",
    glow: "shadow-[0_18px_50px_-30px_rgba(14,165,233,0.35)]",
  },
  rose: {
    badge: "bg-rose-50 text-rose-700 ring-rose-600/10",
    glow: "shadow-[0_18px_50px_-30px_rgba(244,63,94,0.35)]",
  },
  gray: {
    badge: "bg-gray-100 text-gray-700 ring-gray-600/10",
    glow: "shadow-[0_18px_50px_-34px_rgba(75,85,99,0.25)]",
  },
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function numeric(value) {
  return Number(value || 0)
}

function number(value, digits = 2) {
  return numeric(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  })
}

function money(value) {
  return `BDT ${numeric(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`
}

function pretty(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

async function api(path) {
  const token = localStorage.getItem("token")

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Unable to load inventory data."
    )
  }

  return data
}

function Icon({
  icon,
  className = "h-4 w-4",
  strokeWidth = 1.8,
  ...props
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      className={className}
      strokeWidth={strokeWidth}
      {...props}
    />
  )
}

function Skeleton({ className = "" }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-gray-100",
        className
      )}
    />
  )
}

function StatCard({
  icon,
  label,
  value,
  detail,
  tone = "indigo",
  delay = 0,
  loading = false,
}) {
  const styles = TONES[tone] || TONES.indigo

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28 }}
      className={cn(CARD, styles.glow, "p-5")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-500">
            {label}
          </p>

          {loading ? (
            <Skeleton className="mt-2 h-9 w-32" />
          ) : (
            <p className="mt-1 truncate text-[1.65rem] font-extrabold leading-tight tracking-tight text-gray-900 sm:text-[1.75rem] tabular-nums">
              {value}
            </p>
          )}
        </div>

        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1",
            styles.badge
          )}
        >
          {icon}
        </div>
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-3 w-40" />
      ) : (
        <p className="mt-3 text-xs font-medium leading-5 text-gray-500">
          {detail}
        </p>
      )}
    </motion.article>
  )
}

function SectionHeader({
  icon,
  title,
  subtitle,
  tone = "indigo",
  right,
}) {
  const styles = TONES[tone] || TONES.indigo

  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1",
            styles.badge
          )}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold tracking-tight text-gray-900">
            {title}
          </h2>

          <p className="truncate text-sm text-gray-500">
            {subtitle}
          </p>
        </div>
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )
}

function WarehouseValueSkeleton() {
  return Array.from({ length: 6 }).map((_, index) => (
    <div key={index}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>

      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  ))
}

function ValuationTableSkeleton() {
  return Array.from({ length: 6 }).map((_, index) => (
    <tr key={`valuation-skeleton-${index}`}>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-24" />
      </td>

      <td className="px-5 py-4">
        <Skeleton className="h-4 w-16" />
      </td>

      <td className="px-5 py-4 text-right">
        <Skeleton className="ml-auto h-4 w-28" />
      </td>

      <td className="px-5 py-4">
        <Skeleton className="h-2.5 w-full rounded-full" />
      </td>
    </tr>
  ))
}

function ValuationMobileSkeleton() {
  return Array.from({ length: 5 }).map((_, index) => (
    <article
      key={`valuation-mobile-skeleton-${index}`}
      className="p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>

        <Skeleton className="h-5 w-24" />
      </div>

      <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
    </article>
  ))
}

function MovementTableSkeleton() {
  return Array.from({ length: 6 }).map((_, index) => (
    <tr key={index}>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-3 w-20" />
      </td>

      <td className="px-5 py-4">
        <Skeleton className="h-7 w-24 rounded-full" />
      </td>

      <td className="px-5 py-4">
        <Skeleton className="ml-auto h-4 w-16" />
      </td>

      <td className="px-5 py-4">
        <Skeleton className="ml-auto h-4 w-24" />
      </td>
    </tr>
  ))
}

function MovementMobileSkeleton() {
  return Array.from({ length: 4 }).map((_, index) => (
    <article key={index} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>

        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
        <div>
          <Skeleton className="h-3 w-14" />
          <Skeleton className="mt-2 h-4 w-20" />
        </div>

        <div>
          <Skeleton className="h-3 w-14" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
      </div>
    </article>
  ))
}

function MovementBadge({ value }) {
  const normalized = String(value || "").toLowerCase()

  let styles =
    "bg-indigo-50 text-indigo-700 ring-indigo-600/10"

  if (
    normalized.includes("in") ||
    normalized.includes("receipt") ||
    normalized.includes("return_in")
  ) {
    styles =
      "bg-green-50 text-green-700 ring-green-600/10"
  }

  if (
    normalized.includes("out") ||
    normalized.includes("issue") ||
    normalized.includes("consume")
  ) {
    styles =
      "bg-amber-50 text-amber-800 ring-amber-600/10"
  }

  if (
    normalized.includes("loss") ||
    normalized.includes("damage") ||
    normalized.includes("scrap")
  ) {
    styles =
      "bg-rose-50 text-rose-700 ring-rose-600/10"
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1",
        styles
      )}
    >
      {pretty(value)}
    </span>
  )
}

export default function InventoryDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [valuation, setValuation] = useState([])
  const [operations, setOperations] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeReportTab, setActiveReportTab] = useState("valuation")

  const load = useCallback(
    async ({ showToast = false } = {}) => {
      setLoading(true)
      setError("")

      try {
        const [summary, values, workflow] =
          await Promise.all([
            api("/inventory/reports/dashboard"),
            api(
              "/inventory/reports/valuation?groupBy=warehouse&limit=8"
            ),
            api("/inventory/operations/overview"),
          ])

        setDashboard(summary || {})
        setValuation(values?.rows || [])
        setOperations(workflow || {})

        if (showToast) {
          toast.success("Inventory dashboard refreshed")
        }
      } catch (requestError) {
        const message =
          requestError?.message ||
          "Unable to load inventory dashboard."

        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    load()
  }, [load])

  const stock = dashboard?.stock || {}
  const transfers = dashboard?.transfers || {}
  const recentMovements = dashboard?.recentMovements || []

  const maxWarehouseValue = useMemo(
    () =>
      Math.max(
        ...valuation.map((row) =>
          numeric(row.inventoryValue)
        ),
        1
      ),
    [valuation]
  )

  const groupedWarehouseValue = useMemo(
    () =>
      valuation.reduce(
        (sum, row) =>
          sum + numeric(row.inventoryValue),
        0
      ),
    [valuation]
  )

  const metrics = useMemo(
    () => [
      {
        label: "Inventory Quantity",
        value: number(stock.onHandQuantity),
        detail: `${number(stock.availableQuantity)} available for use`,
        tone: "indigo",
        icon: (
          <Icon
            icon={Package01Icon}
            className="h-5 w-5"
          />
        ),
      },
      {
        label: "Inventory Value",
        value: number(stock.inventoryValue),
        detail: "Weighted current inventory valuation",
        tone: "green",
        icon: (
          <Icon
            icon={DashboardSquare01Icon}
            className="h-5 w-5"
          />
        ),
      },
      {
        label: "Active Products",
        value: number(
          dashboard?.activeProducts,
          0
        ),
        detail: `${number(
          dashboard?.activeWarehouses,
          0
        )} active warehouses`,
        tone: "sky",
        icon: (
          <Icon
            icon={Package01Icon}
            className="h-5 w-5"
          />
        ),
      },
      {
        label: "Low Stock",
        value: number(
          dashboard?.lowStockPositions,
          0
        ),
        detail: `${number(
          stock.zeroPositions,
          0
        )} zero-stock positions`,
        tone:
          numeric(dashboard?.lowStockPositions) > 0
            ? "rose"
            : "amber",
        icon: (
          <Icon
            icon={Alert02Icon}
            className="h-5 w-5"
          />
        ),
      },
      {
        label: "Reserved",
        value: number(stock.reservedQuantity),
        detail: "Committed inventory quantity",
        tone: "indigo",
        icon: (
          <Icon
            icon={Package01Icon}
            className="h-5 w-5"
          />
        ),
      },
      {
        label: "Quarantine",
        value: number(stock.quarantineQuantity),
        detail: "Excluded from usable availability",
        tone: "rose",
        icon: (
          <Icon
            icon={Alert02Icon}
            className="h-5 w-5"
          />
        ),
      },
      {
        label: "Pending Transfers",
        value: number(
          transfers.awaitingApproval,
          0
        ),
        detail: `${number(
          transfers.approved,
          0
        )} approved transfers`,
        tone: "amber",
        icon: (
          <Icon
            icon={ArrowDataTransferHorizontalIcon}
            className="h-5 w-5"
          />
        ),
      },
      {
        label: "In Transit",
        value: number(
          transfers.inTransit,
          0
        ),
        detail: `${number(stock.incomingQuantity)} incoming quantity`,
        tone: "sky",
        icon: (
          <Icon
            icon={ArrowDataTransferHorizontalIcon}
            className="h-5 w-5"
          />
        ),
      },
      {
        label: "Pending Requests",
        value: number(
          operations.pendingRequests,
          0
        ),
        detail: `${number(
          operations.approvedRequests,
          0
        )} approved / waiting`,
        tone: "amber",
        icon: (
          <Icon
            icon={DashboardSquare01Icon}
            className="h-5 w-5"
          />
        ),
      },
      {
        label: "Near Expiry",
        value: number(
          operations.nearExpiry,
          0
        ),
        detail: `${number(
          operations.pendingInspections,
          0
        )} inspections waiting`,
        tone: "rose",
        icon: (
          <Icon
            icon={Alert02Icon}
            className="h-5 w-5"
          />
        ),
      },
      {
        label: "Pending Inventory",
        value: number(
          operations.pendingInventory,
          0
        ),
        detail: "Awaiting warehouse and bin assignment",
        tone: "sky",
        icon: (
          <Icon
            icon={Package01Icon}
            className="h-5 w-5"
          />
        ),
      },
      {
        label: "Inventory Loss",
        value: number(
          operations.currentLossValue
        ),
        detail: `${number(
          operations.consumption30Days
        )} consumed in the last 30 days`,
        tone:
          numeric(operations.currentLossValue) > 0
            ? "rose"
            : "green",
        icon: (
          <Icon
            icon={Alert02Icon}
            className="h-5 w-5"
          />
        ),
      },
    ],
    [
      dashboard,
      operations,
      stock,
      transfers,
    ]
  )

  return (
    <div className="min-h-screen bg-gray-50 p-1 sm:p-4 lg:p-6">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2600,
          style: {
            borderRadius: "14px",
            fontWeight: 700,
          },
        }}
      />

      <div className="mx-auto w-full max-w-[1600px]">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            SOFT,
            "mb-6 p-5 sm:p-6"
          )}
        >
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-indigo-500/25 blur-lg" />

                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                  <Icon
                    icon={DashboardSquare01Icon}
                    className="h-6 w-6"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                    Inventory Dashboard
                  </h1>

                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700 ring-1 ring-indigo-600/10">
                    Stock Operations
                  </span>
                </div>

                <p className="mt-1 max-w-3xl text-sm text-gray-500">
                  Products, stock availability, valuation, replenishment alerts, transfers, and recent inventory movement activity.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                load({
                  showToast: true,
                })
              }
              disabled={loading}
              className={cn(
                BUTTON,
                GHOST_BUTTON,
                "self-start lg:self-auto"
              )}
            >
              <Icon
                icon={RefreshIcon}
                className={cn(
                  "h-4 w-4",
                  loading ? "animate-spin" : ""
                )}
              />

              {loading ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </motion.header>

        {error ? (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            <Icon
              icon={Alert02Icon}
              className="mt-0.5 h-5 w-5 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                Inventory dashboard could not be fully loaded
              </p>

              <p className="mt-1 text-sm font-medium text-rose-600">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 text-rose-500 transition hover:bg-rose-100"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        ) : null}

        <section className="mb-6">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-gray-900">
                Inventory Summary
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Current operational and stock-health indicators.
              </p>
            </div>

            <span className="hidden text-xs font-semibold text-gray-400 sm:inline">
              Live inventory metrics
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(
              (metric, index) => (
                <StatCard
                  key={metric.label}
                  {...metric}
                  loading={loading}
                  delay={index * 0.035}
                />
              )
            )}
          </div>
        </section>

        <div className={cn(CARD, "mb-4 p-2")}>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {[
              [
                "valuation",
                "Valuation Report",
                DashboardSquare01Icon,
                valuation.length,
              ],
              [
                "movements",
                "Recent Movements",
                ArrowDataTransferHorizontalIcon,
                recentMovements.length,
              ],
            ].map(([key, label, icon, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveReportTab(key)}
                className={cn(
                  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-extrabold transition sm:px-5 sm:text-sm",
                  activeReportTab === key
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon
                  icon={icon}
                  className="h-4 w-4"
                />

                <span>{label}</span>

                {!loading ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-black",
                      activeReportTab === key
                        ? "bg-white/15 text-white"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {activeReportTab === "valuation" ? (
          <motion.section
            key="valuation-report"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className={cn(
              SOFT,
              "overflow-hidden"
            )}
          >
            <SectionHeader
              icon={
                <Icon
                  icon={DashboardSquare01Icon}
                  className="h-5 w-5"
                />
              }
              title="Warehouse Valuation Report"
              subtitle="Current weighted inventory value grouped by warehouse"
              tone="indigo"
              right={
                loading ? null : (
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Grouped Value
                    </p>

                    <p className="mt-0.5 text-base font-extrabold text-gray-900">
                      {money(groupedWarehouseValue)}
                    </p>
                  </div>
                )
              }
            />

            <div className="hidden max-h-[620px] overflow-auto lg:block">
              <table className="w-full min-w-[820px] text-left">
                <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur">
                  <tr className="text-xs font-black uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3">
                      Warehouse
                    </th>

                    <th className="px-5 py-3">
                      Share
                    </th>

                    <th className="px-5 py-3 text-right">
                      Inventory Value
                    </th>

                    <th className="w-[34%] px-5 py-3">
                      Distribution
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <ValuationTableSkeleton />
                  ) : valuation.length ? (
                    valuation.map((row, index) => {
                      const value = numeric(
                        row.inventoryValue
                      )

                      const width = Math.max(
                        3,
                        (value / maxWarehouseValue) * 100
                      )

                      const share =
                        groupedWarehouseValue > 0
                          ? (value /
                              groupedWarehouseValue) *
                            100
                          : 0

                      return (
                        <tr
                          key={
                            row._id ||
                            row.entity?._id ||
                            row.entity?.code ||
                            index
                          }
                          className="bg-white transition hover:bg-indigo-50/30"
                        >
                          <td className="px-5 py-4">
                            <p className="text-sm font-extrabold text-gray-900">
                              {row.entity?.name ||
                                row.entity?.code ||
                                "Unassigned"}
                            </p>

                            <p className="mt-1 text-xs font-medium text-gray-400">
                              {row.entity?.code ||
                                "Warehouse valuation"}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700 ring-1 ring-indigo-100">
                              {number(share)}%
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <p className="text-sm font-extrabold text-gray-900">
                              {money(value)}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${width}%`,
                                }}
                                transition={{
                                  duration: 0.5,
                                  delay: index * 0.04,
                                }}
                                className="h-full rounded-full bg-indigo-600"
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-16 text-center"
                      >
                        <Icon
                          icon={Package01Icon}
                          className="mx-auto h-8 w-8 text-gray-300"
                        />

                        <p className="mt-3 text-sm font-bold text-gray-900">
                          No warehouse valuation yet
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          Warehouse valuation will appear after posted inventory activity.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 lg:hidden">
              {loading ? (
                <ValuationMobileSkeleton />
              ) : valuation.length ? (
                valuation.map((row, index) => {
                  const value = numeric(
                    row.inventoryValue
                  )

                  const width = Math.max(
                    3,
                    (value / maxWarehouseValue) * 100
                  )

                  const share =
                    groupedWarehouseValue > 0
                      ? (value /
                          groupedWarehouseValue) *
                        100
                      : 0

                  return (
                    <article
                      key={
                        row._id ||
                        row.entity?._id ||
                        row.entity?.code ||
                        index
                      }
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-gray-900">
                            {row.entity?.name ||
                              row.entity?.code ||
                              "Unassigned"}
                          </p>

                          <p className="mt-1 text-xs font-medium text-gray-400">
                            {number(share)}% of grouped value
                          </p>
                        </div>

                        <p className="shrink-0 text-sm font-extrabold text-indigo-700">
                          {money(value)}
                        </p>
                      </div>

                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${width}%`,
                          }}
                          transition={{
                            duration: 0.5,
                            delay: index * 0.04,
                          }}
                          className="h-full rounded-full bg-indigo-600"
                        />
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="p-12 text-center">
                  <Icon
                    icon={Package01Icon}
                    className="mx-auto h-8 w-8 text-gray-300"
                  />

                  <p className="mt-3 text-sm font-bold text-gray-900">
                    No warehouse valuation yet
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Warehouse valuation will appear after posted inventory activity.
                  </p>
                </div>
              )}
            </div>

            {!loading && valuation.length ? (
              <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-gray-500">
                  {valuation.length}{" "}
                  {valuation.length === 1
                    ? "warehouse"
                    : "warehouses"}{" "}
                  shown
                </p>

                <span className="text-xs font-semibold text-gray-400">
                  Total grouped value: {money(groupedWarehouseValue)}
                </span>
              </div>
            ) : null}
          </motion.section>
        ) : (
          <motion.section
            key="movement-report"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className={cn(
              SOFT,
              "overflow-hidden"
            )}
          >
            <SectionHeader
              icon={
                <Icon
                  icon={ArrowDataTransferHorizontalIcon}
                  className="h-5 w-5"
                />
              }
              title="Recent Stock Movements"
              subtitle="Permanent posted inventory activity"
              tone="sky"
              right={
                !loading && recentMovements.length ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600">
                    {recentMovements.length} records
                  </span>
                ) : null
              }
            />

            <div className="hidden max-h-[620px] overflow-auto lg:block">
              <table className="w-full min-w-[760px] text-left">
                <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur">
                  <tr className="text-xs font-black uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3">
                      Reference
                    </th>

                    <th className="px-5 py-3">
                      Type
                    </th>

                    <th className="px-5 py-3 text-right">
                      Quantity
                    </th>

                    <th className="px-5 py-3 text-right">
                      Value
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <MovementTableSkeleton />
                  ) : recentMovements.length ? (
                    recentMovements.map(
                      (movement, index) => (
                        <tr
                          key={
                            movement._id ||
                            `${movement.movementNo}-${index}`
                          }
                          className="bg-white transition hover:bg-indigo-50/30"
                        >
                          <td className="px-5 py-4">
                            <p className="text-sm font-extrabold text-gray-900">
                              {movement.movementNo ||
                                movement.reference ||
                                "-"}
                            </p>

                            <p className="mt-1 text-xs font-medium text-gray-400">
                              {formatDate(
                                movement.movementDate
                              )}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <MovementBadge
                              value={movement.movementType}
                            />
                          </td>

                          <td className="px-5 py-4 text-right">
                            <p className="text-sm font-extrabold text-gray-900">
                              {number(
                                movement.totalQuantity
                              )}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <p className="text-sm font-extrabold text-indigo-700">
                              {money(
                                movement.totalValue
                              )}
                            </p>
                          </td>
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-16 text-center"
                      >
                        <Icon
                          icon={Package01Icon}
                          className="mx-auto h-8 w-8 text-gray-300"
                        />

                        <p className="mt-3 text-sm font-bold text-gray-900">
                          No posted movements found
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          Posted inventory movements will appear here.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 lg:hidden">
              {loading ? (
                <MovementMobileSkeleton />
              ) : recentMovements.length ? (
                recentMovements.map(
                  (movement, index) => (
                    <article
                      key={
                        movement._id ||
                        `${movement.movementNo}-${index}`
                      }
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-gray-900">
                            {movement.movementNo ||
                              movement.reference ||
                              "-"}
                          </p>

                          <p className="mt-1 text-xs font-medium text-gray-400">
                            {formatDate(
                              movement.movementDate
                            )}
                          </p>
                        </div>

                        <MovementBadge
                          value={movement.movementType}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
                        <div>
                          <p className="text-xs font-bold text-gray-400">
                            Quantity
                          </p>

                          <p className="mt-1 text-sm font-extrabold text-gray-900">
                            {number(
                              movement.totalQuantity
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-gray-400">
                            Value
                          </p>

                          <p className="mt-1 text-sm font-extrabold text-indigo-700">
                            {money(
                              movement.totalValue
                            )}
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                )
              ) : (
                <div className="p-12 text-center">
                  <Icon
                    icon={Package01Icon}
                    className="mx-auto h-8 w-8 text-gray-300"
                  />

                  <p className="mt-3 text-sm font-bold text-gray-900">
                    No posted movements found
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Posted inventory movements will appear here.
                  </p>
                </div>
              )}
            </div>

            {!loading && recentMovements.length ? (
              <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-gray-500">
                  {recentMovements.length}{" "}
                  recent movement
                  {recentMovements.length === 1
                    ? ""
                    : "s"}{" "}
                  shown
                </p>

                <span className="text-xs font-semibold text-gray-400">
                  Posted inventory activity
                </span>
              </div>
            ) : null}
          </motion.section>
        )}

      </div>
    </div>
  )
}
