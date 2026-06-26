"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useSelector } from "react-redux"
import { useLocation, useNavigate } from "react-router-dom"
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa"
import Sidebar from "./Sidebar"
import { sections } from "./sections"
import SessionExpiryGuard from "../Auth/SessionExpiredModal"
import { buildDashboardRouteMap, matchDashboardRoute } from "../Navigation/dashboardRoutes"
import { filterSectionsByPermission } from "../Auth/permissions"

export default function EmployeeDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentUserRedux = useSelector((state) => state.user?.currentUser)
  const [currentUser, setCurrentUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const allowedSections = useMemo(
    () => filterSectionsByPermission(sections, currentUser || currentUserRedux),
    [currentUser, currentUserRedux]
  )
  const routeMap = useMemo(() => buildDashboardRouteMap("/employee", allowedSections), [allowedSections])
  const routeState = useMemo(
    () => matchDashboardRoute(location.pathname, "/employee", routeMap),
    [location.pathname, routeMap]
  )
  const defaultEmployeePath = useMemo(() => {
    if (routeMap.routes?.["/employee"]) return "/employee"
    return Object.keys(routeMap.routes || {})[0] || "/employee"
  }, [routeMap])
  const activeSection = routeState.section
  const activeSubcategory = routeState.subcategory
  const pendingSectionRef = useRef(activeSection)

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") return true
    const savedTheme = localStorage.getItem("theme")
    return savedTheme ? savedTheme === "dark" : true
  })
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    if (!isMobile) setIsSidebarOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (currentUserRedux) {
      setCurrentUser(currentUserRedux)
      setAuthChecked(true)
      return
    }

    try {
      const stored = localStorage.getItem("user")
      setCurrentUser(stored ? JSON.parse(stored) : null)
    } catch {
      setCurrentUser(null)
    } finally {
      setAuthChecked(true)
    }
  }, [currentUserRedux])

  useEffect(() => {
    if (!authChecked) return
    if (!currentUser || currentUser.role !== "employee" || !currentUser.isActive) {
      navigate("/login", { replace: true })
    }
  }, [authChecked, currentUser, navigate])

  useEffect(() => {
    if (!authChecked || !currentUser || currentUser.role !== "employee" || !currentUser.isActive) return

    const cleanPath = location.pathname.replace(/\/+$/, "") || "/"
    const isCustomerDetailPath =
      cleanPath.startsWith("/employee/customers/") || cleanPath.startsWith("/employee/clients/")
    const routeIsAllowed =
      Boolean(routeMap.routes?.[cleanPath]) ||
      (isCustomerDetailPath && Boolean(allowedSections.Clients))
    const sectionIsAllowed = Boolean(allowedSections[activeSection])

    if (!routeIsAllowed || !sectionIsAllowed) {
      navigate(defaultEmployeePath, { replace: true })
    }
  }, [
    activeSection,
    allowedSections,
    authChecked,
    currentUser,
    defaultEmployeePath,
    location.pathname,
    navigate,
    routeMap,
  ])

  useEffect(() => {
    pendingSectionRef.current = activeSection
  }, [activeSection])

  const toggleSidebar = () => setIsSidebarOpen((value) => !value)
  const closeMobileSidebar = () => {
    if (isMobile) setIsSidebarOpen(false)
  }

  const setActiveSection = (section) => {
    pendingSectionRef.current = section
    navigate(routeMap.reverse[`${section}::`] || "/employee")
    closeMobileSidebar()
  }

  const setActiveSubcategory = (subcategory) => {
    if (!subcategory) return
    const section = pendingSectionRef.current || activeSection
    navigate(
      routeMap.reverse[`${section}::${subcategory}`] ||
        routeMap.reverse[`${section}::`] ||
        "/employee"
    )
    closeMobileSidebar()
  }

  const activeView = useMemo(() => {
    const section = allowedSections[activeSection]
    if (!section) return null
    if (section.subcategories) {
      return section.subcategories[activeSubcategory] || Object.values(section.subcategories)[0] || null
    }
    return section.component || null
  }, [activeSection, activeSubcategory, allowedSections])

  const content = useMemo(() => {
    if (!activeView) return null
    const injectedProps =
      activeSection === "Clients"
        ? {
            routeCustomerId: routeState.customerId || null,
            onNavigateCustomer: (customerId) =>
              navigate(`/employee/clients/${customerId}/overview`),
            onBackToCustomers: () => navigate("/employee/clients"),
          }
        : {}

    if (React.isValidElement(activeView)) return React.cloneElement(activeView, injectedProps)
    if (typeof activeView === "function") {
      const Component = activeView
      return <Component {...injectedProps} />
    }
    return null
  }, [activeView, activeSection, routeState.customerId, navigate])

  if (!authChecked) return <div className="h-screen w-full bg-gray-50" />

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      <SessionExpiryGuard />
      <Sidebar
        setActiveSection={setActiveSection}
        setActiveSubcategory={setActiveSubcategory}
        sections={allowedSections}
        activeSection={activeSection}
        activeSubcategory={activeSubcategory}
        isMobile={isMobile}
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />

      <main className="h-screen flex-1 overflow-auto p-5 transition-colors">{content}</main>

      {isMobile && (
        <button
          className={`fixed top-4 z-50 rounded-full bg-blue-700 p-2 text-white shadow-md transition-all duration-300 ${
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
