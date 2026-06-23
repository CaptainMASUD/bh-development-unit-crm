"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useSelector } from "react-redux"
import { useLocation, useNavigate } from "react-router-dom"
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa"
import Sidebar from "./Sidebar"
import { sections } from "./sections"
import SessionExpiryGuard from "../Auth/SessionExpiredModal"
import { buildDashboardRouteMap, matchDashboardRoute } from "../Navigation/dashboardRoutes"

export default function AdminDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = useSelector((state) => state.user?.currentUser)
  const routeMap = useMemo(() => buildDashboardRouteMap("/admin", sections), [])
  const routeState = useMemo(
    () => matchDashboardRoute(location.pathname, "/admin", routeMap),
    [location.pathname, routeMap]
  )
  const activeSection = routeState.section
  const activeSubcategory = routeState.subcategory
  const pendingSectionRef = useRef(activeSection)

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem("theme") : null
    return savedTheme ? savedTheme === "dark" : true
  })

  useEffect(() => {
    const role = currentUser?.role
    if (!currentUser || !["admin", "superadmin"].includes(role) || !currentUser.isActive) {
      navigate("/login", { replace: true })
    }
  }, [currentUser, navigate])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    pendingSectionRef.current = activeSection
  }, [activeSection])

  const toggleSidebar = () => setIsSidebarOpen((value) => !value)
  const closeMobileSidebar = () => {
    if (isMobile) setIsSidebarOpen(false)
  }

  const setActiveSection = (section) => {
    pendingSectionRef.current = section
    navigate(routeMap.reverse[`${section}::`] || "/admin")
    closeMobileSidebar()
  }

  const setActiveSubcategory = (subcategory) => {
    if (!subcategory) return
    const section = pendingSectionRef.current || activeSection
    navigate(routeMap.reverse[`${section}::${subcategory}`] || routeMap.reverse[`${section}::`] || "/admin")
    closeMobileSidebar()
  }

  const openCustomerDetails = (customerId) => {
    if (!customerId) return
    navigate(`/admin/client-tasks/${customerId}`)
    closeMobileSidebar()
  }

  const activeView = useMemo(() => {
    const section = sections?.[activeSection]
    if (!section) return null
    if (section.subcategories) {
      return section.subcategories?.[activeSubcategory] || Object.values(section.subcategories)[0] || null
    }
    return section.component || null
  }, [activeSection, activeSubcategory])

  const content = useMemo(() => {
    if (!activeView) return null

    let injectedProps = { openCustomerDetails }
    if (activeSection === "Clients" && activeSubcategory === "Client Tasks") {
      injectedProps = {
        ...injectedProps,
        openCustomerId: routeState.customerId || null,
        onSelectCustomer: (customerId) => navigate(`/admin/client-tasks/${customerId}`),
      }
    }
    if (activeSection === "Clients" && activeSubcategory === "Clients") {
      injectedProps = {
        ...injectedProps,
        routeCustomerId: routeState.customerId || null,
        routeCustomerTab: routeState.customerTab || "overview",
        onNavigateCustomer: (customerId, tab = "overview") =>
          navigate(`/admin/clients/${customerId}/${tab}`),
        onBackToCustomers: () => navigate("/admin/clients/clients"),
      }
    }

    if (React.isValidElement(activeView)) return React.cloneElement(activeView, injectedProps)
    if (typeof activeView === "function") {
      const Component = activeView
      return <Component {...injectedProps} />
    }
    return null
  }, [activeView, activeSection, activeSubcategory, routeState, navigate])

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      <SessionExpiryGuard />
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

      <main className="h-screen flex-1 overflow-auto p-5 transition-colors">{content}</main>

      <button
        className={`fixed top-4 z-50 rounded-full bg-blue-700 p-2 text-white shadow-md transition-all duration-300 md:hidden ${
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
