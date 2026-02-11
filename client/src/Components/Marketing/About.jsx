"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import logo from "../../../public/crm.png"
import {
  FiUsers,
  FiUserCheck,
  FiCheckCircle,
  FiTrendingUp,
  FiShield,
  FiClock,
  FiExternalLink,
  FiTag,
  FiLock,
  FiMail,
  FiCode,
  FiLayers,
  FiCpu,
  FiGlobe,
  FiActivity,
  FiBookOpen,
  FiX,
  FiPhone,
  FiUser,
} from "react-icons/fi"

/* ---------- styles ---------- */
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)]"
const softCard =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_16px_44px_-34px_rgba(0,0,0,0.55)]"

const chip =
  "inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold ring-1 ring-gray-200 bg-white text-gray-700 shadow-sm"

const mini =
  "rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3 flex items-center gap-3"

/* ---------- reusable ---------- */
function InfoCard({ icon, title, desc }) {
  return (
    <div className={softCard}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{desc}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatPill({ icon, label, value }) {
  return (
    <div className={mini}>
      <div className="w-10 h-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-indigo-700">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500">{label}</p>
        <p className="text-sm font-extrabold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="my-6 border-t border-gray-100" />
}

function Modal({ open, title, subtitle, icon, children, onClose, footer }) {
  const closeBtnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const t = setTimeout(() => closeBtnRef.current?.focus(), 60)
    return () => {
      clearTimeout(t)
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="w-full max-w-2xl rounded-2xl bg-white border border-gray-100 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)] overflow-hidden"
        >
          <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {icon ? (
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  {icon}
                </div>
              ) : null}

              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-gray-900">{title}</h3>
                {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
              </div>
            </div>

            <button
              ref={closeBtnRef}
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition"
              aria-label="Close"
              title="Close"
            >
              <FiX className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>

          {footer ? <div className="p-5 border-t border-gray-100 bg-gray-50">{footer}</div> : null}
        </motion.div>
      </div>
    </div>
  )
}

function GuideSection({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-sm font-extrabold text-gray-900">{title}</p>
      <div className="mt-2 text-sm text-gray-600 leading-relaxed">{children}</div>
    </div>
  )
}

/* ✅ CRA/Vite friendly: logo import gives URL string */
function LogoImg({ className = "" }) {
  return (
    <img
      src={logo}
      alt="CRM Logo"
      className={`object-contain ${className}`}
      loading="eager"
      decoding="async"
    />
  )
}

export default function About() {
  const [guideOpen, setGuideOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)

  const meta = useMemo(
    () => ({
     productName: "CRM System",
      company: "Captains IT & Business Hub",
      version: "v1.0.6",
      releaseChannel: "Production",
      lastUpdated: "2025-02-08",
      docsLabel: "User Guide",
    }),
    []
  )

  // ✅ Fill with your real phone/email
  const supportContact = useMemo(
    () => ({
      name: "Mahmudur Rahman",
      phone: "+880 1712244886",
      email: "businesshublink@gmail.com",
    }),
    []
  )

  const mailto = useMemo(() => {
    return `mailto:${supportContact.email}?subject=${encodeURIComponent(
      `${meta.productName} Support`
    )}&body=${encodeURIComponent(
      "Hi Mahmudur,%0D%0A%0D%0AI need help with:%0D%0A- Issue:%0D%0A- Steps:%0D%0A%0D%0AThanks."
    )}`
  }, [supportContact.email, meta.productName])

  const tel = useMemo(() => {
    const cleaned = String(supportContact.phone || "").replace(/[^\d+]/g, "")
    return cleaned ? `tel:${cleaned}` : ""
  }, [supportContact.phone])

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* Modals */}
      <AnimatePresence>
        {guideOpen && (
          <Modal
            open={guideOpen}
            title="User Guide"
            subtitle="Quick instructions to use the CRM smoothly."
            icon={<FiBookOpen className="w-5 h-5" />}
            onClose={() => setGuideOpen(false)}
            footer={
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  onClick={() => setGuideOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
                >
                  Close
                </button>
              </div>
            }
          >
            <div className="space-y-3">
              <GuideSection title="1) Login & Roles">
                Use your email and password to log in. Your role (Admin / Employee / Marketing Team)
                controls what you can access.
              </GuideSection>

              <GuideSection title="2) Customers & Assignments">
                Admins can create customers and assign them to employees. Employees see only assigned
                customers and can update progress.
              </GuideSection>

              <GuideSection title="3) Update Work Status">
                Open a customer, update the work status (in progress / completed) and add any notes if
                available.
              </GuideSection>

              <GuideSection title="4) User Management (Admins)">
                Admins can create and manage Employees, Marketing Team users, and Admins. Super Admins
                can manage Super Admin accounts.
              </GuideSection>

              <GuideSection title="5) Best Practices">
                Keep titles, statuses, and notes updated daily. Use search to quickly find customers or
                users.
              </GuideSection>

              <div className="rounded-2xl border border-gray-100 bg-indigo-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-700">
                    <FiShield className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">Security note</p>
                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                      Don’t share accounts. If you suspect unusual activity, contact support immediately.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {supportOpen && (
          <Modal
            open={supportOpen}
            title="Support / Contact"
            subtitle="Reach out for help or technical support."
            icon={<FiMail className="w-5 h-5" />}
            onClose={() => setSupportOpen(false)}
            footer={
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  onClick={() => setSupportOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
                >
                  Close
                </button>

                <a
                  href={mailto}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] transition"
                >
                  <FiExternalLink className="w-4 h-4" />
                  Email Support
                </a>

                {tel ? (
                  <a
                    href={tel}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
                  >
                    <FiPhone className="w-4 h-4" />
                    Call
                  </a>
                ) : null}
              </div>
            }
          >
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                  <FiUser className="w-5 h-5" />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900">{supportContact.name}</p>
                  <p className="text-sm text-gray-600 mt-1">Support Contact Person</p>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <FiPhone className="w-4 h-4 text-indigo-600" />
                      <span className="font-semibold">{supportContact.phone}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-700 break-words">
                      <FiMail className="w-4 h-4 text-indigo-600" />
                      <span className="font-semibold">{supportContact.email}</span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm font-extrabold text-gray-900">When contacting</p>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                      Please include: your name, role, what you were doing, and a screenshot if possible.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={`${card} p-6`}>
          <div className="flex flex-col lg:flex-row justify-between gap-6">
            {/* Left */}
            <div className="flex items-center gap-5">
              {/* ✅ Bigger logo + better alignment */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-indigo-500/25 rounded-[26px] blur-xl" />
                <div className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-[26px] bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                  <LogoImg className="w-12 h-12 sm:w-14 sm:h-14" />
                </div>
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                  About {meta.productName}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Developed by <span className="font-semibold text-gray-900">{meta.company}</span>
                </p>

                {/* Meta strip (wrap nicely) */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 text-xs font-semibold">
                    <FiLayers className="w-4 h-4" />
                    {meta.version}
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-gray-700 ring-1 ring-gray-200 text-xs font-semibold">
                    <FiActivity className="w-4 h-4 text-gray-600" />
                    {meta.releaseChannel}
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-gray-700 ring-1 ring-gray-200 text-xs font-semibold">
                    <FiClock className="w-4 h-4 text-gray-600" />
                    Updated: {meta.lastUpdated}
                  </span>
                </div>
              </div>
            </div>

            {/* Right chips */}
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <span className={chip}>
                <FiTag className="w-4 h-4" />
                Business CRM
              </span>
              <span className={chip}>
                <FiShield className="w-4 h-4" />
                Secure System
              </span>
              <span className={chip}>
                <FiUsers className="w-4 h-4" />
                Team Based
              </span>
              <span className={chip}>
                <FiGlobe className="w-4 h-4" />
                Web App
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Main */}
        <div className="xl:col-span-2 space-y-4">
          <div className={`${card} p-6`}>
            <h2 className="text-lg font-extrabold text-gray-900">What is this system used for?</h2>

            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              This CRM keeps customers, tasks, and team responsibilities in one place. It helps your
              company work faster, stay updated, and reduce confusion by tracking progress and ownership
              clearly.
            </p>

            {/* Quick stats */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <StatPill icon={<FiShield className="w-5 h-5" />} label="Access Control" value="Role-based" />
              <StatPill icon={<FiUsers className="w-5 h-5" />} label="Team Workflow" value="Assignments" />
              <StatPill icon={<FiTrendingUp className="w-5 h-5" />} label="Productivity" value="Improved tracking" />
            </div>

            <Divider />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard
                icon={<FiUsers className="w-5 h-5" />}
                title="Customer Management"
                desc="Store customer details, contact persons, phone numbers, and addresses in a clean and organized way."
              />

              <InfoCard
                icon={<FiUserCheck className="w-5 h-5" />}
                title="Employee Assignment"
                desc="Admins can assign customers to specific employees so everyone knows their responsibility."
              />

              <InfoCard
                icon={<FiCheckCircle className="w-5 h-5" />}
                title="Work Status Tracking"
                desc="Track whether customer work is in progress or completed to stay updated at all times."
              />

              <InfoCard
                icon={<FiTrendingUp className="w-5 h-5" />}
                title="Better Productivity"
                desc="Clear information and assignments help reduce mistakes and improve overall work efficiency."
              />
            </div>

            {/* Role info */}
            <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                  <FiLock className="w-5 h-5 text-gray-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900">Roles & permissions</p>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    <strong>Admins</strong> can manage customers, assign work, manage users, and update
                    system information.
                    <br />
                    <strong>Employees</strong> can view only assigned customers and update work progress.
                    <br />
                    <strong>Marketing Team</strong> can manage leads and follow-up activities.
                  </p>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`${softCard} p-5`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 flex items-center justify-center">
                    <FiLock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">Security tip</p>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                      Use strong passwords and avoid sharing accounts. Roles help keep data protected.
                    </p>
                  </div>
                </div>
              </div>

              <div className={`${softCard} p-5`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 flex items-center justify-center">
                    <FiClock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">Workflow tip</p>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                      Keep statuses and notes updated daily to maintain clear progress visibility.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Release notes */}
          <div className={`${card} p-6`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Release notes</h2>
                <p className="text-sm text-gray-500 mt-1">What’s included in this version</p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold ring-1 ring-gray-200">
                <FiCode className="w-4 h-4" />
                {meta.version}
              </div>
            </div>

            <ul className="mt-4 space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                <span>Improved user management flow and role-based visibility for teams.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                <span>Cleaner UI components for faster navigation and reduced clutter.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                <span>Security hardening with permission rules and safer account management.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right */}
        <div className="xl:col-span-1 space-y-4">
          <div className={`${card} p-6`}>
            <h2 className="text-lg font-extrabold text-gray-900">System details</h2>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <StatPill icon={<FiLayers className="w-5 h-5" />} label="Version" value={meta.version} />
              <StatPill icon={<FiActivity className="w-5 h-5" />} label="Channel" value={meta.releaseChannel} />
              <StatPill icon={<FiCpu className="w-5 h-5" />} label="Build" value="Stable" />
              <StatPill icon={<FiClock className="w-5 h-5" />} label="Last Updated" value={meta.lastUpdated} />
            </div>

            <Divider />

            <h3 className="text-sm font-extrabold text-gray-900">Credits</h3>

            <div className="mt-3 space-y-3">
              <div className="rounded-xl border p-4">
                <p className="text-sm font-extrabold text-gray-900">Developed By</p>
                <p className="text-sm text-gray-600">Captains IT &amp; Business Hub</p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm font-extrabold text-gray-900">Purpose</p>
                <p className="text-sm text-gray-600">
                  To simplify customer handling, improve team coordination, and bring transparency to daily
                  business operations.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <FiClock className="w-4 h-4" />
                Back to Top
              </button>

              <button
                onClick={() => setGuideOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-white hover:bg-gray-50 transition"
              >
                <FiBookOpen className="w-4 h-4" />
                {meta.docsLabel}
              </button>

              <button
                onClick={() => setSupportOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-white hover:bg-gray-50 transition"
              >
                <FiMail className="w-4 h-4" />
                Support / Contact
              </button>
            </div>

            <p className="mt-4 text-xs text-gray-500">Made with care by Captains IT &amp; Business Hub.</p>
          </div>

          <div className={`${card} p-6`}>
            <h3 className="text-sm font-extrabold text-gray-900">Built for teams</h3>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              Keep information clean, track progress daily, and use roles to keep data protected.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <StatPill icon={<FiUsers className="w-5 h-5" />} label="Users" value="Admins • Employees • Marketing" />
              <StatPill icon={<FiGlobe className="w-5 h-5" />} label="Platform" value="Web based" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
