"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa"
import Sidebar from "./Sidebar"
import { sections } from "./sections"

export default function AdminDashboard() {
  const navigate = useNavigate()
  const currentUser = useSelector((state) => state.user?.currentUser)

  const [activeSection, setActiveSection] = useState("Dashboard")
  const [activeSubcategory, setActiveSubcategory] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem("theme") : null
    return savedTheme ? savedTheme === "dark" : true
  })

  // ✅ bridge: used to open CustomerCRMInner directly
  const [openCustomerId, setOpenCustomerId] = useState(null)

  // ✅ allow admin + superadmin
  useEffect(() => {
    const role = currentUser?.role
    const isAdminLike = role === "admin" || role === "superadmin"
    if (!currentUser || !isAdminLike || !currentUser.isActive) {
      navigate("/login")
    }
  }, [currentUser, navigate])

  // responsive sidebar
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const toggleSidebar = () => setIsSidebarOpen((s) => !s)

  /**
   * ✅ IMPORTANT:
   * Clicking customer/task anywhere should open:
   * Clients -> Client Tasks (CustomerCRMInner)
   */
  const openCustomerDetails = (customerId) => {
    if (!customerId) return

    setActiveSection("Clients")
    setActiveSubcategory("Client Tasks") // ✅ open CustomerCRMInner
    setOpenCustomerId(String(customerId))

    if (isMobile) setIsSidebarOpen(false)
  }

  /**
   * ✅ IMPORTANT:
   * - if section has subcategories -> render active subcategory component
   * - else -> render normal section.component
   */
  const activeView = useMemo(() => {
    const section = sections?.[activeSection]
    if (!section) return null

    if (section.subcategories) {
      // choose first subcategory by default (optional)
      if (!activeSubcategory) {
        return (
          <div className="p-6 text-sm text-gray-500">
            Select an option from <b>{activeSection}</b>.
          </div>
        )
      }
      return section.subcategories?.[activeSubcategory] ?? null
    }

    return section.component ?? null
  }, [activeSection, activeSubcategory])

  const content = useMemo(() => {
    if (!activeView) return null

    // ✅ inject props into all pages (dashboard can call openCustomerDetails)
    // ✅ inject openCustomerId only to Client Tasks page (CustomerCRMInner)
    const injectedProps =
      activeSection === "Clients" && activeSubcategory === "Client Tasks"
        ? {
            openCustomerId,
            onCustomerOpened: () => setOpenCustomerId(null),
            openCustomerDetails,
          }
        : { openCustomerDetails }

    if (React.isValidElement(activeView)) {
      return React.cloneElement(activeView, injectedProps)
    }

    if (typeof activeView === "function") {
      const Comp = activeView
      return <Comp {...injectedProps} />
    }

    return null
  }, [activeView, activeSection, activeSubcategory, openCustomerId])

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
        openCustomerDetails={openCustomerDetails}
        onOpenCustomer={openCustomerDetails}
      />

      <main className="flex-1 h-screen overflow-auto p-5 transition-colors">{content}</main>

      <button
        className={`fixed top-4 z-50 p-2 bg-blue-700 text-white rounded-full shadow-md transition-all duration-300 md:hidden ${
          isSidebarOpen ? "left-[260px]" : "left-4"
        }`}
        onClick={toggleSidebar}
        aria-label="Toggle Sidebar"
      >
        {isSidebarOpen ? <FaAngleDoubleLeft size={22} /> : <FaAngleDoubleRight size={22} />}
      </button>
    </div>
  )
}
