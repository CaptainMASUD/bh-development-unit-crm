"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { FaTimes, FaBolt, FaShieldAlt, FaTachometerAlt, FaFeatherAlt } from "react-icons/fa"
import jetsky from "../../../public/jetsky.svg"

export default function JetskyModal({ isOpen, onClose, isDarkMode }) {
  // 1) Always declare hooks in the same order
  const [mounted, setMounted] = useState(false)

  // mark mounted once on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // lock scroll + esc to close (effect is always declared; logic gated)
  useEffect(() => {
    if (!mounted || !isOpen) return

    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKey = (e) => e.key === "Escape" && onClose && onClose()
    window.addEventListener("keydown", onKey)

    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [mounted, isOpen, onClose])

  // 2) After hooks, you can early-return
  if (!mounted || !isOpen) return null

  const modal = (
    <>
      <style>{`
        @keyframes modalFadeIn { from {opacity:0} to {opacity:1} }
        @keyframes modalSlideUp { from {transform:translateY(16px);opacity:0} to {transform:translateY(0);opacity:1} }
        @keyframes ringPulse {
          0%   { transform: translate(-50%, -50%) scale(1);   opacity: .45; }
          70%  { transform: translate(-50%, -50%) scale(1.9); opacity: .12; }
          100% { transform: translate(-50%, -50%) scale(2.1); opacity: 0; }
        }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        .animate-modal-fade   { animation: modalFadeIn .25s ease-out both; }
        .animate-modal-panel  { animation: modalSlideUp .28s cubic-bezier(.22,.61,.36,1) both; }
        .animate-ring         { animation: ringPulse 2.2s ease-out infinite; }
        .animate-ring.delay-1 { animation-delay: .5s; }
        .animate-ring.delay-2 { animation-delay: 1s; }
        .animate-float        { animation: floatY 4s ease-in-out infinite; }
      `}</style>

      <div
        className={`fixed inset-0 z-[1000] ${isDarkMode ? "bg-black/70" : "bg-black/50"} flex items-center justify-center p-4 animate-modal-fade`}
        role="dialog"
        aria-modal="true"
        aria-label="Jetsky Performance"
        onClick={onClose}
      >
        <div
          className={`relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl animate-modal-panel ${
            isDarkMode ? "bg-gray-900 text-white border border-white/10" : "bg-white text-gray-900 border border-gray-200"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? "border-white/10" : "border-gray-200"}`}>
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full ${isDarkMode ? "bg-white" : "bg-transparent"} flex items-center justify-center`}>
                <img src={jetsky?.src || jetsky} alt="Jetsky" className="h-10 w-10 select-none" draggable={false} />
              </div>
              <h3 className="text-lg font-semibold">Jetsky™ Performance</h3>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
              aria-label="Close"
            >
              <FaTimes />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 grid md:grid-cols-2 gap-6">
            {/* Left: perfectly centered badge + rings */}
            <div className="relative flex flex-col items-center text-center">
              <div className="relative w-40 h-40">
                {/* Anchor at exact center */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  {/* Deep red glow */}
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 opacity-30 blur-3xl"
                    aria-hidden
                  />
                  {/* Pulsing rings */}
                  <span className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500/40 animate-ring" aria-hidden />
                  <span className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500/30 animate-ring delay-1" aria-hidden />
                  <span className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500/20 animate-ring delay-2" aria-hidden />

                  {/* Floating badge */}
                  <div
                    className={`relative mx-auto h-28 w-28 rounded-full ${isDarkMode ? "bg-white" : "bg-gray-100"} flex items-center justify-center shadow animate-float`}
                    style={{ boxShadow: "0 22px 70px rgba(239,68,68,0.45), 0 8px 24px rgba(239,68,68,0.25)" }}
                  >
                    <img src={jetsky?.src || jetsky} alt="Jetsky large" className="h-24 w-24 select-none" draggable={false} />
                  </div>
                </div>
              </div>

              <p className={`mt-4 text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                Jetsky reduces load time, optimizes app performance, and caches smartly,  keeps everything fast and fluid.
              </p>
            </div>

            {/* Right: features */}
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className={`mt-1 ${isDarkMode ? "text-yellow-300" : "text-yellow-600"}`}><FaBolt /></span>
                <div>
                  <p className="font-medium">High-Performance Mode</p>
                  <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Aggressive prefetch & render optimizations.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className={`mt-1 ${isDarkMode ? "text-green-300" : "text-green-600"}`}><FaShieldAlt /></span>
                <div>
                  <p className="font-medium">100% Secure</p>
                  <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Follows best practices for data handling.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className={`mt-1 ${isDarkMode ? "text-blue-300" : "text-blue-600"}`}><FaTachometerAlt /></span>
                <div>
                  <p className="font-medium">Faster Performance</p>
                  <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Low-latency interactions & instant feedback.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className={`mt-1 ${isDarkMode ? "text-purple-300" : "text-purple-600"}`}><FaFeatherAlt /></span>
                <div>
                  <p className="font-medium">Reduced Loading Time</p>
                  <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Smart chunking and caching reduce wait time.</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Footer */}
          <div className={`px-6 py-4 border-t ${isDarkMode ? "border-white/10" : "border-gray-200"} text-right`}>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium ${isDarkMode ? "bg-white/10 hover:bg-white/15" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(modal, document.body)
}
