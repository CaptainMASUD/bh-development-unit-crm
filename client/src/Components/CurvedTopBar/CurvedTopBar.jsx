"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  DashboardSquare01Icon,
  BookOpen01Icon,
  NoteEditIcon,
  Invoice01Icon,
  CreditCardIcon,
  MoneyReceive01Icon,
  MoneySend01Icon,
  ChartLineData01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"

const cn = (...classes) => classes.filter(Boolean).join(" ")

const accountingNavigation = [
  {
    id: "overview",
    name: "Overview",
    icon: DashboardSquare01Icon,
    route: "/admin/accounting",
    tone: "indigo",
  },
  {
    id: "accounts",
    name: "Chart of Accounts",
    icon: BookOpen01Icon,
    route: "/admin/accounting/chart-of-accounts",
    tone: "emerald",
  },
  {
    id: "journal",
    name: "Journal Entry",
    icon: NoteEditIcon,
    route: "/admin/accounting/journal-entry",
    tone: "orange",
  },
  {
    id: "vouchers",
    name: "Vouchers",
    icon: Invoice01Icon,
    route: "/admin/accounting/vouchers",
    tone: "rose",
  },
  {
    id: "cash-bank",
    name: "Cash & Bank",
    icon: CreditCardIcon,
    route: "/admin/accounting/cash-bank",
    tone: "cyan",
  },
  {
    id: "receivables",
    name: "Receivables",
    icon: MoneyReceive01Icon,
    route: "/admin/accounting/receivables",
    tone: "sky",
  },
  {
    id: "payables",
    name: "Payables",
    icon: MoneySend01Icon,
    route: "/admin/accounting/payables",
    tone: "amber",
  },
  {
    id: "reports",
    name: "Reports",
    icon: ChartLineData01Icon,
    route: "/admin/accounting/reports",
    tone: "violet",
  },
  {
    id: "settings",
    name: "Settings",
    icon: Settings01Icon,
    route: "/admin/accounting/settings",
    tone: "slate",
  },
]

const iconTones = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  orange: "bg-orange-50 text-orange-600",
  rose: "bg-rose-50 text-rose-600",
  cyan: "bg-cyan-50 text-cyan-600",
  sky: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-600",
}

function NavigationStyles() {
  return (
    <style>{`
      .accounting-curved-scroll::-webkit-scrollbar {
        display: none;
      }

      .accounting-curved-scroll {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `}</style>
  )
}

function navigateToPage(item, onNavigate) {
  if (!item) return

  if (typeof onNavigate === "function") {
    onNavigate(item)
    return
  }

  if (typeof window !== "undefined" && item.route) {
    window.location.assign(item.route)
  }
}

function CurvedBackground() {
  const shape = `
    M 0 0
    H 1000
    L 982 39
    C 978 51, 970 59, 954 59
    H 46
    C 30 59, 22 51, 18 39
    Z
  `

  return (
    <svg
      viewBox="0 0 1000 60"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="
        pointer-events-none
        absolute inset-0
        h-full w-full
        overflow-visible
      "
      style={{
        filter:
          "drop-shadow(0 17px 18px rgba(15, 23, 42, 0.13))",
      }}
    >
      <path
        d={shape}
        fill="#ffffff"
        stroke="#eef2f7"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function NavigationItem({
  item,
  active,
  isLast,
  onClick,
}) {
  const tone =
    iconTones[item.tone] ||
    iconTones.indigo

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          `
            group relative inline-flex
            h-[56px] shrink-0
            cursor-pointer items-center
            justify-center gap-2.5
            px-4 text-[14px]
            font-semibold whitespace-nowrap
            transition duration-200
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-inset
            focus-visible:ring-indigo-300
            sm:px-5
          `,
          active
            ? "text-indigo-700"
            : `
                text-slate-800
                hover:text-slate-950
              `
        )}
      >
        <span
          className={cn(
            `
              flex h-[25px] w-[25px]
              shrink-0 items-center
              justify-center rounded-[7px]
              transition duration-200
              group-hover:scale-105
            `,
            tone,
            active &&
              "ring-2 ring-indigo-100"
          )}
        >
          <HugeiconsIcon
            icon={item.icon}
            size={15}
            color="currentColor"
            strokeWidth={1.8}
          />
        </span>

        <span>{item.name}</span>

        {active ? (
          <motion.span
            layoutId="accounting-active-navigation"
            className="
              absolute bottom-[2px]
              left-1/2 h-[3px]
              w-7 -translate-x-1/2
              rounded-t-full
              bg-indigo-600
            "
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 34,
            }}
          />
        ) : null}
      </button>

      {!isLast ? (
        <span
          className="
            h-[42px] w-px
            shrink-0 bg-slate-200
          "
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}

export default function AccountingCurvedTopBar({
  defaultActive = "overview",
  onNavigate,
}) {
  const [activeTab, setActiveTab] =
    useState(defaultActive)

  const handleNavigation = (item) => {
    setActiveTab(item.id)
    navigateToPage(item, onNavigate)
  }

  return (
    <div className="relative z-30 w-full">
      <NavigationStyles />

      <div
        className="
          mx-auto flex w-full
          justify-center px-3
          sm:px-5
        "
      >
        <div
          className="
            relative h-[60px]
            w-full max-w-[1080px]
          "
        >
          <CurvedBackground />

          <nav
            aria-label="Accounting navigation"
            className="
              accounting-curved-scroll
              relative z-10
              mx-[20px] flex h-full
              items-start overflow-x-auto
              overscroll-x-contain
              px-2
              sm:mx-[32px]
              sm:px-3
            "
          >
            {accountingNavigation.map(
              (item, index) => (
                <NavigationItem
                  key={item.id}
                  item={item}
                  active={
                    activeTab === item.id
                  }
                  isLast={
                    index ===
                    accountingNavigation.length -
                      1
                  }
                  onClick={() =>
                    handleNavigation(item)
                  }
                />
              )
            )}
          </nav>
        </div>
      </div>
    </div>
  )
}