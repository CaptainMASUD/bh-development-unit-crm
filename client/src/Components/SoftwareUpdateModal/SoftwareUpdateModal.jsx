"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Modal, Button, Tooltip, Spinner } from "flowbite-react"
import {
  FiDownloadCloud,
  FiCheck,
  FiInfo,
  FiClock,
  FiShield,
  FiRefreshCw,
  FiAlertTriangle,
  FiCpu,
  FiHardDrive,
  FiGlobe,
  FiPackage,
} from "react-icons/fi"

/**
 * POS Software Update Modal – Powered by Captains IT
 * - Self-manages localStorage flag so it only shows once per version/build
 * - No alerts — uses a small info modal for messages
 * - “Restart POS” appears only after 100% complete; clicking reloads the page
 *
 * Branding:
 *   Website: https://captains-it.vercel.app/
 *   Email:   captainsit9@gmail.com
 */
export default function SoftwareUpdateModal({
  version = "v 2.0.0.0",
  build = "build 241001",
  releaseDate = new Date().toLocaleDateString(),
  sizeMB = 138,
  notes = [
    "New: Multi-counter sync, faster Z report export",
    "Fix: Discount rounding for mixed GST/VAT items",
    "Improved: Barcode scan latency on low-end devices",
    "Offline: Auto-retry queue with backoff logic",
    "Security: Hardened session tokens & role checks",
  ],
  defaultOpen = true,
  simulate = true,
  mandatory = false,
}) {
  // ------- derived keys & state -------
  const updateKey = useMemo(() => `captainsIT:update:${version}-${build}:done`, [version, build])

  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState("idle") // idle | downloading | installing | done | error
  const [progress, setProgress] = useState(0)
  const [mini, setMini] = useState({ open: false, title: "", body: "" })

  const isBusy = status === "downloading" || status === "installing"
  const showRestart = status === "done" && progress >= 100

  const bannerLabel = useMemo(() => {
    if (status === "downloading") return "Downloading update…"
    if (status === "installing") return "Installing update…"
    if (status === "done") return "Update complete"
    if (status === "error") return "Update failed"
    return "Software update available"
  }, [status])

  // decide open state on mount using localStorage
  useEffect(() => {
    try {
      const isDone = typeof window !== "undefined" && localStorage.getItem(updateKey) === "true"
      setOpen(defaultOpen && !isDone)
    } catch {
      setOpen(defaultOpen) // fallback if storage is blocked
    }
  }, [updateKey, defaultOpen])

  // simulate progress safely (no TS)
  const loopRef = useRef(null)
  useEffect(() => {
    return () => {
      if (loopRef.current) {
        clearTimeout(loopRef.current)
      }
    }
  }, [])

  const installNow = async () => {
    try {
      setStatus("downloading")
      setProgress(0)

      if (simulate) {
        await simulateBar(0, 100, 140, setProgress)
      }

      setStatus("installing")
      if (simulate) await wait(1400)

      setStatus("done")
      setProgress(100)

      // mark as done so it won't show next time
      try {
        localStorage.setItem(updateKey, "true")
      } catch {}
    } catch (e) {
      setStatus("error")
    }
  }

  const scheduleLater = () => {
    setMini({
      open: true,
      title: "Update scheduled",
      body:
        "The POS will install the update automatically tonight at 2:00 AM. Keep the device powered and connected.",
    })
  }

  const checkAgain = () => {
    setMini({
      open: true,
      title: "You’re up to date",
      body: `No newer updates found. Current: ${version} • ${build}`,
    })
  }

  const onClose = () => {
    if (mandatory || status === "installing") return
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <Modal
          show={open}
          onClose={mandatory ? undefined : onClose}
          dismissible={!mandatory}
          size="6xl"
          className="backdrop-blur-sm"
        >
          <Modal.Header className="border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/30 rounded-xl blur-lg" />
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center">
                  <FiPackage className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900">{bannerLabel}</div>
                <div className="text-xs text-gray-500">
                  POS update – Powered by{" "}
                  <a
                    className="text-indigo-600 hover:underline"
                    href="https://captains-it.vercel.app/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Captains IT
                  </a>
                </div>
              </div>
            </div>
          </Modal.Header>

          <Modal.Body className="relative overflow-hidden">
            {/* soft decorative glows */}
            <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 blur-3xl" />

            <div className="relative space-y-5">
              {/* meta row */}
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                <MetaChip icon={<FiPackage className="w-4 h-4" />} label="Version" value={`${version} • ${build}`} />
                <MetaChip icon={<FiClock className="w-4 h-4" />} label="Release date" value={String(releaseDate)} />
                <MetaChip icon={<FiHardDrive className="w-4 h-4" />} label="Size" value={`${sizeMB} MB`} />
              </motion.div>

              {/* progress */}
              {status !== "idle" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 rounded-2xl border border-gray-100 bg-white"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="text-sm font-medium text-gray-900">
                      {status === "downloading" && "Downloading package"}
                      {status === "installing" && "Installing update"}
                      {status === "done" && "All set!"}
                      {status === "error" && "Something went wrong"}
                    </div>
                    <div className="text-xs text-gray-500">{progress}%</div>
                  </div>
                  <ProgressBar value={progress} state={status} />
                  {status === "error" && (
                    <div className="mt-2 text-xs text-rose-600 inline-flex items-center gap-1">
                      <FiAlertTriangle /> Check your internet and try again.
                    </div>
                  )}
                </motion.div>
              )}

              {/* release notes */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 p-5 rounded-2xl border border-gray-100 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center">
                      <FiDownloadCloud className="w-5 h-5" />
                    </div>
                    <div className="text-base font-semibold text-gray-900">What’s new</div>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {notes.map((n, i) => (
                      <li key={i} className="inline-flex items-start gap-2">
                        <Dot />
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 text-xs text-gray-500 inline-flex items-center gap-1">
                    <FiInfo className="opacity-70" /> Your sales data remains safe. We’ll never overwrite your records.
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-gray-100 bg-white relative overflow-hidden">
                  <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-br from-amber-500/15 to-orange-500/15 blur-2xl" />
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center">
                      <FiShield className="w-5 h-5" />
                    </div>
                    <div className="text-base font-semibold text-gray-900">Before you update</div>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="inline-flex items-center gap-2">
                      <FiCheck className="text-emerald-600" /> Ensure stable internet
                    </li>
                    <li className="inline-flex items-center gap-2">
                      <FiCheck className="text-emerald-600" /> Keep the POS plugged in
                    </li>
                    <li className="inline-flex items-center gap-2">
                      <FiCheck className="text-emerald-600" /> Finish ongoing bills
                    </li>
                  </ul>
                  <div className="mt-3 text-xs text-gray-500 inline-flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <FiCpu className="opacity-70" /> Min RAM: 4GB
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FiHardDrive className="opacity-70" /> Free disk: 1GB
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FiGlobe className="opacity-70" /> Stable network
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer className="border-t border-gray-100 flex items-center justify-between">
            <div className="text-[11px] text-gray-500 inline-flex items-center gap-2 flex-wrap">
              <span>
                Powered by{" "}
                <a
                  className="font-medium text-gray-800 hover:underline"
                  href="https://captains-it.vercel.app/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Captains IT
                </a>
              </span>
              <span>•</span>
              <a className="hover:underline" href="mailto:captainsit9@gmail.com">
                captainsit9@gmail.com
              </a>
              <span>•</span>
              <Tooltip content="Check again for updates">
                <button onClick={checkAgain} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900">
                  <FiRefreshCw className="w-3.5 h-3.5" /> Check again
                </button>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2">
              {!mandatory && !isBusy && status !== "done" && (
                <Button color="gray" onClick={onClose}>
                  Close
                </Button>
              )}

              {status === "idle" && (
                <>
                  <Button color="light" onClick={scheduleLater}>
                    Schedule later
                  </Button>
                  <Button onClick={installNow} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0">
                    <span className="inline-flex items-center gap-2">
                      <FiDownloadCloud /> Install now
                    </span>
                  </Button>
                </>
              )}

              {status === "downloading" && (
                <Button disabled className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0">
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="sm" /> Downloading…
                  </span>
                </Button>
              )}

              {status === "installing" && (
                <Button disabled className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0">
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="sm" /> Installing…
                  </span>
                </Button>
              )}

              {showRestart && (
                <Button color="success" onClick={() => window.location.reload()}>
                  <span className="inline-flex items-center gap-2">
                    <FiCheck /> Restart POS
                  </span>
                </Button>
              )}
            </div>
          </Modal.Footer>
        </Modal>
      )}

      {/* Mini information modal (no alerts) */}
      <Modal
        show={mini.open}
        onClose={() => setMini((m) => ({ ...m, open: false }))}
        size="lg"
        className="backdrop-blur-sm"
      >
        <Modal.Header className="border-b border-gray-100">{mini.title}</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-gray-700">{mini.body}</p>
        </Modal.Body>
        <Modal.Footer className="border-t border-gray-100">
          <Button onClick={() => setMini((m) => ({ ...m, open: false }))}>Close</Button>
        </Modal.Footer>
      </Modal>
    </AnimatePresence>
  )
}

/* ----------------- atoms ----------------- */
function MetaChip({ icon, label, value }) {
  return (
    <div className="relative rounded-2xl p-4 border border-gray-100 bg-white">
      <div className="absolute inset-0 opacity-10 rounded-2xl blur-lg bg-gradient-to-br from-indigo-500 to-purple-600" />
      <div className="relative flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-gray-50 text-gray-700 flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
          <div className="text-sm font-semibold text-gray-900">{value}</div>
        </div>
      </div>
    </div>
  )
}

function Dot() {
  return <span className="mt-2 inline-flex w-2 h-2 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600" />
}

function ProgressBar({ value = 0, state = "idle" }) {
  const bar = state === "error" ? "bg-rose-500" : state === "done" ? "bg-emerald-500" : "bg-indigo-500"
  const width = Math.min(100, Math.max(0, value))
  return (
    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${bar} transition-all duration-300`} style={{ width: `${width}%` }} />
    </div>
  )
}

// ----- tiny async helpers -----
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function simulateBar(from, to, stepMs, setter) {
  let p = from
  while (p < to) {
    // eslint-disable-next-line no-await-in-loop
    await wait(stepMs)
    p = Math.min(to, p + Math.max(1, Math.round((to - from) / 12)))
    setter(p)
  }
}
