"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSelector } from "react-redux"
import { useLocation, useNavigate } from "react-router-dom"
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa"
import Sidebar from "./Sidebar"
import { sections } from "./sections"
import { buildDashboardRouteMap, matchDashboardRoute } from "../Navigation/dashboardRoutes"
import { buildModuleSections, canAccessModule, findModuleForSection, isKnownModule, MODULES } from "../Navigation/moduleConfig"

const ModuleDashboard = React.lazy(() => import("./dashboard/ModuleDashboard"))

export default function AdminDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = useSelector((state) => state.user?.currentUser)
  const moduleId = location.pathname.split("/").filter(Boolean)[1] || ""
  const validModule = isKnownModule(moduleId) && canAccessModule(currentUser, moduleId)
  const moduleBasePath = validModule ? `/admin/${moduleId}` : "/admin"
  const moduleSections = useMemo(() => validModule ? buildModuleSections(sections, moduleId, currentUser?.role) : {}, [currentUser?.role, moduleId, validModule])
  const routeMap = useMemo(() => buildDashboardRouteMap(moduleBasePath, moduleSections), [moduleBasePath, moduleSections])
  const routeState = useMemo(
    () => matchDashboardRoute(location.pathname, moduleBasePath, routeMap),
    [location.pathname, moduleBasePath, routeMap]
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
    if (!currentUser || !["admin", "superadmin"].includes(currentUser.role) || !currentUser.isActive || validModule) return
    if (location.pathname.replace(/\/+$/, "") === "/admin") {
      navigate("/module", { replace: true })
      return
    }
    const legacyMap = buildDashboardRouteMap("/admin", sections)
    const legacy = matchDashboardRoute(location.pathname, "/admin", legacyMap)
    const targetModule = findModuleForSection(legacy.section, currentUser?.role)
    if (!targetModule) return navigate("/module", { replace: true })
    const targetSections = buildModuleSections(sections, targetModule, currentUser?.role)
    const targetMap = buildDashboardRouteMap(`/admin/${targetModule}`, targetSections)
    navigate(targetMap.reverse[`${legacy.section}::${legacy.subcategory || ""}`] || `/admin/${targetModule}`, { replace: true })
  }, [currentUser, location.pathname, navigate, validModule])

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

  const setActiveSection = useCallback((section) => {
    pendingSectionRef.current = section
    navigate(routeMap.reverse[`${section}::`] || moduleBasePath)
    if (isMobile) setIsSidebarOpen(false)
  }, [isMobile, moduleBasePath, navigate, routeMap])

  const setActiveSubcategory = (subcategory) => {
    if (!subcategory) return
    const section = pendingSectionRef.current || activeSection
    navigate(routeMap.reverse[`${section}::${subcategory}`] || routeMap.reverse[`${section}::`] || moduleBasePath)
    closeMobileSidebar()
  }

  const openCustomerDetails = useCallback((customerId) => {
    if (!customerId) return
    navigate(`${moduleBasePath}/client-tasks/${customerId}`)
    if (isMobile) setIsSidebarOpen(false)
  }, [isMobile, moduleBasePath, navigate])

  const activeView = useMemo(() => {
    const section = moduleSections?.[activeSection]
    if (!section) return null
    if (section.subcategories) {
      return section.subcategories?.[activeSubcategory] || Object.values(section.subcategories)[0] || null
    }
    return section.component || null
  }, [activeSection, activeSubcategory, moduleSections])

  const content = useMemo(() => {
    if (activeSection === "Dashboard" && !MODULES[moduleId]?.useSectionDashboard) {
      return (
        <ModuleDashboard
          moduleId={moduleId}
          moduleSections={moduleSections}
          currentUser={currentUser}
          onNavigateSection={setActiveSection}
        />
      )
    }
    if (!activeView) return null

    let injectedProps = { openCustomerDetails }
    if (activeSection === "Clients" && activeSubcategory === "Client Tasks") {
      injectedProps = {
        ...injectedProps,
        openCustomerId: routeState.customerId || null,
        onSelectCustomer: (customerId) => navigate(`${moduleBasePath}/client-tasks/${customerId}`),
      }
    }
    if (activeSection === "Clients" && activeSubcategory === "Clients") {
      injectedProps = {
        ...injectedProps,
        routeCustomerId: routeState.customerId || null,
        routeCustomerTab: routeState.customerTab || "overview",
        onNavigateCustomer: (customerId, tab = "overview") =>
          navigate(`${moduleBasePath}/clients/${customerId}/${tab}`),
        onBackToCustomers: () => navigate(`${moduleBasePath}/clients/clients`),
      }
    }

    if (React.isValidElement(activeView)) return React.cloneElement(activeView, injectedProps)
    if (typeof activeView === "function") {
      const Component = activeView
      return <Component {...injectedProps} />
    }
    return null
  }, [activeView, activeSection, activeSubcategory, routeState, navigate, moduleBasePath, moduleId, moduleSections, currentUser, openCustomerDetails, setActiveSection])

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      <Sidebar
        setActiveSection={setActiveSection}
        setActiveSubcategory={setActiveSubcategory}
        sections={moduleSections}
        moduleLabel={MODULES[moduleId]?.name}
        onOpenModules={() => navigate("/module")}
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

      <main className="h-screen flex-1 overflow-auto p-5 transition-colors">
        <React.Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-gray-100" />}>{content}</React.Suspense>
      </main>

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
