"use client"

import { useEffect, useMemo, useState } from "react"
import { useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa"
import Sidebar from "./Sidebar"
import { sections } from "./sections"

export default function EmployeeDashboard() {
  const navigate = useNavigate()
  const currentUserRedux = useSelector((state) => state.user?.currentUser)

  const [activeSection, setActiveSection] = useState("Dashboard")
  const [activeSubcategory, setActiveSubcategory] = useState("")

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") return true
    const savedTheme = localStorage.getItem("theme")
    return savedTheme ? savedTheme === "dark" : true
  })

  const [currentUser, setCurrentUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  // init isMobile safely
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  // if switching to desktop, close mobile sidebar
  useEffect(() => {
    if (!isMobile) setIsSidebarOpen(false)
  }, [isMobile])

  // resolve user from redux or localStorage
  useEffect(() => {
    if (currentUserRedux) {
      setCurrentUser(currentUserRedux)
      setAuthChecked(true)
      return
    }

    try {
      const stored = localStorage.getItem("user")
      const parsed = stored ? JSON.parse(stored) : null
      setCurrentUser(parsed)
    } catch {
      setCurrentUser(null)
    } finally {
      setAuthChecked(true)
    }
  }, [currentUserRedux])

  // protect route (only after authChecked)
  useEffect(() => {
    if (!authChecked) return
    if (!currentUser || currentUser.role !== "employee" || !currentUser.isActive) {
      navigate("/login")
    }
  }, [authChecked, currentUser, navigate])

  const toggleSidebar = () => setIsSidebarOpen((s) => !s)

  const content = useMemo(() => {
    const section = sections[activeSection]
    if (!section) return null
    return section.component || section.subcategories?.[activeSubcategory] || null
  }, [activeSection, activeSubcategory])

  // optional: don't render until auth checked (prevents flash)
  if (!authChecked) {
    return <div className="h-screen w-full bg-gray-50" />
  }

  return (
    <div className="flex h-screen w-full overflow-hidden relative">
      <Sidebar
        setActiveSection={setActiveSection}
        setActiveSubcategory={setActiveSubcategory}
        sections={sections}
        activeSection={activeSection}
        activeSubcategory={activeSubcategory}
        isMobile={isMobile}
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />

      <main className="flex-1 h-screen overflow-auto p-5 transition-colors">
        {content}
      </main>

      {/* Mobile sidebar toggle */}
      {isMobile && (
        <button
          className={`fixed top-4 z-50 p-2 bg-blue-700 text-white rounded-full shadow-md transition-all duration-300 ${
            isSidebarOpen ? "left-[260px]" : "left-4"
          }`}
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
        >
          {isSidebarOpen ? <FaAngleDoubleLeft size={22} /> : <FaAngleDoubleRight size={22} />}
        </button>
      )}
    </div>
  )
}
