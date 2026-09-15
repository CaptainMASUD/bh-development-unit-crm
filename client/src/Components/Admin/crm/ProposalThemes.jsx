"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Briefcase01Icon,
  CheckmarkCircle02Icon,
  File02Icon,
  ShoppingBag01Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons"

export const DEFAULT_PROPOSAL_THEME_ID = "executive-blue"

export const PROPOSAL_THEMES = [
  {
    id: "executive-blue",
    name: "Executive Blue",
    category: "Corporate / General",
    description: "Clean, restrained and decision-maker friendly for general B2B proposals.",
    icon: Briefcase01Icon,
    accent: "#4f46e5",
    accentSoft: "#eef2ff",
    accentBorder: "#c7d2fe",
    ink: "#111827",
    muted: "#64748b",
    eyebrow: "Commercial Proposal",
    requirementTitle: "Client requirements",
    solutionTitle: "Our proposed solution",
    itemsTitle: "Products / services",
    timelineTitle: "Implementation plan",
    investmentTitle: "Commercial summary",
    defaultSolution: "We will deliver a focused solution aligned with the client requirements, agreed scope and measurable business outcomes.",
    defaultImplementation: "1. Confirm scope and responsibilities\n2. Prepare and approve the delivery plan\n3. Execute the agreed work\n4. Review, hand over and close the project",
    defaultTerms: "Pricing and delivery are based on the scope listed in this proposal. Any additional work or material change in scope will be reviewed and agreed before execution. Payment schedule and taxes will follow the final commercial agreement.",
  },
  {
    id: "digital-indigo",
    name: "Digital Product",
    category: "Software / SaaS",
    description: "Product-led proposal for software, automation, SaaS and technical implementation work.",
    icon: Target01Icon,
    accent: "#6d28d9",
    accentSoft: "#f5f3ff",
    accentBorder: "#ddd6fe",
    ink: "#171321",
    muted: "#6b7280",
    eyebrow: "Digital Solution Proposal",
    requirementTitle: "Business & technical priorities",
    solutionTitle: "Recommended solution",
    itemsTitle: "Solution components",
    timelineTitle: "Delivery roadmap",
    investmentTitle: "Project investment",
    defaultSolution: "Our recommendation connects the client priorities to a practical digital solution, with clear deliverables, ownership and implementation milestones.",
    defaultImplementation: "Discovery & confirmation → UX / solution design → Development & integration → QA / UAT → Deployment → Handover & support",
    defaultTerms: "The proposal covers the features and deliverables listed below. Change requests outside the approved scope may affect timeline and cost. Deployment, third-party subscriptions and support terms will follow the final project agreement.",
  },
  {
    id: "web-studio",
    name: "Web & UX Studio",
    category: "Website / UI/UX",
    description: "Editorial, outcome-focused proposal for websites, redesigns and UX engagements.",
    icon: File02Icon,
    accent: "#0f766e",
    accentSoft: "#f0fdfa",
    accentBorder: "#99f6e4",
    ink: "#102a2a",
    muted: "#64748b",
    eyebrow: "Website & Experience Proposal",
    requirementTitle: "Goals & current challenges",
    solutionTitle: "Experience direction",
    itemsTitle: "Scope & deliverables",
    timelineTitle: "Design & delivery process",
    investmentTitle: "Project fee",
    defaultSolution: "We will translate the client goals into a clear, responsive and conversion-aware experience with a structured design and development process.",
    defaultImplementation: "Research & content alignment → Information architecture → UI/UX design → Development → Responsive QA → Launch & handover",
    defaultTerms: "The scope includes the deliverables listed in this proposal. Content, integrations and revision rounds should be finalized before delivery starts. Additional pages or features can be quoted separately when requested.",
  },
  {
    id: "product-supply",
    name: "Product & Supply",
    category: "Products / Procurement",
    description: "Pricing-first layout for physical products, supply contracts and quantity-based quotations.",
    icon: ShoppingBag01Icon,
    accent: "#b45309",
    accentSoft: "#fffbeb",
    accentBorder: "#fde68a",
    ink: "#292524",
    muted: "#78716c",
    eyebrow: "Supply & Commercial Offer",
    requirementTitle: "Supply requirement",
    solutionTitle: "Supply approach",
    itemsTitle: "Products & quantities",
    timelineTitle: "Delivery & fulfillment",
    investmentTitle: "Quotation total",
    defaultSolution: "We will supply the listed products according to the confirmed specification, quantity, delivery schedule and commercial terms.",
    defaultImplementation: "Confirm product specifications and quantities → Confirm stock / procurement → Prepare delivery → Client receiving / verification → Final commercial settlement",
    defaultTerms: "Prices are based on the listed quantities and validity period. Availability, delivery schedule, taxes and transport charges are subject to the final confirmed order and commercial agreement.",
  },
]

export function getProposalTheme(themeId) {
  return PROPOSAL_THEMES.find((theme) => theme.id === themeId) || PROPOSAL_THEMES[0]
}

const META_PREFIX = "[[BH_PROPOSAL_META:"
const META_SUFFIX = "]]"

export function encodeProposalContent({
  themeId = DEFAULT_PROPOSAL_THEME_ID,
  clientRequirements = "",
  solution = "",
  implementationPlan = "",
} = {}) {
  const metadata = encodeURIComponent(JSON.stringify({
    version: 1,
    themeId,
    clientRequirements: String(clientRequirements || "").trim(),
    implementationPlan: String(implementationPlan || "").trim(),
  }))
  const solutionText = String(solution || "").trim()
  return `${META_PREFIX}${metadata}${META_SUFFIX}${solutionText ? `\n${solutionText}` : ""}`
}

export function decodeProposalContent(notes = "", fallback = {}) {
  const raw = String(notes || "")
  const match = raw.match(/^\[\[BH_PROPOSAL_META:([^\]]+)\]\]\s*/)
  if (!match) {
    return {
      themeId: fallback.themeId || DEFAULT_PROPOSAL_THEME_ID,
      clientRequirements: fallback.clientRequirements || "",
      solution: raw.trim(),
      implementationPlan: fallback.implementationPlan || "",
    }
  }

  try {
    const meta = JSON.parse(decodeURIComponent(match[1]))
    return {
      themeId: meta?.themeId || fallback.themeId || DEFAULT_PROPOSAL_THEME_ID,
      clientRequirements: meta?.clientRequirements || fallback.clientRequirements || "",
      solution: raw.slice(match[0].length).trim(),
      implementationPlan: meta?.implementationPlan || fallback.implementationPlan || "",
    }
  } catch {
    return {
      themeId: fallback.themeId || DEFAULT_PROPOSAL_THEME_ID,
      clientRequirements: fallback.clientRequirements || "",
      solution: raw.trim(),
      implementationPlan: fallback.implementationPlan || "",
    }
  }
}

function ThemeIcon({ icon, className = "h-5 w-5" }) {
  return <HugeiconsIcon icon={icon} className={className} strokeWidth={1.8} />
}

export function ProposalThemePicker({ value = DEFAULT_PROPOSAL_THEME_ID, onChange, compact = false }) {
  return (
    <div className={compact ? "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"}>
      {PROPOSAL_THEMES.map((theme) => {
        const active = value === theme.id
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onChange?.(theme.id)}
            className={`group relative overflow-hidden rounded-2xl border bg-white text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${compact ? "min-w-[170px] flex-1 p-3" : "p-4"}`}
            style={{ borderColor: active ? theme.accent : "#e5e7eb", boxShadow: active ? `0 0 0 2px ${theme.accentSoft}` : undefined }}
            aria-pressed={active}
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: theme.accent }} />
            <div className="flex items-start justify-between gap-3">
              <span className={`flex items-center justify-center rounded-xl ${compact ? "h-8 w-8" : "h-10 w-10"}`} style={{ color: theme.accent, background: theme.accentSoft }}>
                <ThemeIcon icon={theme.icon} className={compact ? "h-4 w-4" : "h-5 w-5"} />
              </span>
              {active ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ color: theme.accent, background: theme.accentSoft }}>
                  <ThemeIcon icon={CheckmarkCircle02Icon} className="h-4 w-4" />
                </span>
              ) : null}
            </div>
            <p className={`${compact ? "mt-2" : "mt-3"} text-sm font-black text-gray-950`}>{theme.name}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: theme.accent }}>{theme.category}</p>
            {!compact ? <p className="mt-2 text-xs font-medium leading-5 text-gray-500">{theme.description}</p> : null}
            {!compact ? <div className="mt-3 flex gap-1.5">
              {[theme.ink, theme.accent, theme.accentSoft].map((color) => (
                <span key={color} className="h-3 w-8 rounded-full border border-black/5" style={{ background: color }} />
              ))}
            </div> : null}
          </button>
        )
      })}
    </div>
  )
}
