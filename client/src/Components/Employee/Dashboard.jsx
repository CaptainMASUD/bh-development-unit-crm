"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSelector } from "react-redux"
import { useLocation, useNavigate } from "react-router-dom"
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa"
import Sidebar from "../Admin/Sidebar"
import { sections } from "./sections"
import { buildDashboardRouteMap, matchDashboardRoute } from "../Navigation/dashboardRoutes"
import { filterSectionsByPermission } from "../Auth/permissions"
import { buildModuleSections, canAccessModule, findModuleForSection, isKnownModule, MODULES } from "../Navigation/moduleConfig"

const ModuleDashboard = React.lazy(() => import("../Admin/dashboard/ModuleDashboard"))

export default function EmployeeDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentUserRedux = useSelector((state) => state.user?.currentUser)
  const [currentUser, setCurrentUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const allowedSections = useMemo(() => {
    const permitted = filterSectionsByPermission(sections, currentUser || currentUserRedux)
    return { ...permitted, Dashboard: sections.Dashboard }
  }, [currentUser, currentUserRedux])
  const moduleId = location.pathname.split("/").filter(Boolean)[1] || ""
  const validModule = isKnownModule(moduleId) && canAccessModule(currentUser || currentUserRedux, moduleId)
  const moduleBasePath = validModule ? `/employee/${moduleId}` : "/employee"
  const moduleSections = useMemo(() => validModule ? buildModuleSections(allowedSections, moduleId, "employee") : {}, [allowedSections, moduleId, validModule])
  const routeMap = useMemo(() => buildDashboardRouteMap(moduleBasePath, moduleSections), [moduleBasePath, moduleSections])
  const routeState = useMemo(
    () => matchDashboardRoute(location.pathname, moduleBasePath, routeMap),
    [location.pathname, moduleBasePath, routeMap]
  )
  const defaultEmployeePath = useMemo(() => {
    return Object.keys(routeMap.routes || {})[0] || moduleBasePath
  }, [moduleBasePath, routeMap])
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
    if (!authChecked || !currentUser || currentUser.role !== "employee" || !currentUser.isActive || validModule) return
    if (location.pathname.replace(/\/+$/, "") === "/employee") {
      navigate("/module", { replace: true })
      return
    }
    const legacyMap = buildDashboardRouteMap("/employee", allowedSections)
    const legacy = matchDashboardRoute(location.pathname, "/employee", legacyMap)
    const targetModule = findModuleForSection(legacy.section, "employee")
    if (!targetModule || !canAccessModule(currentUser, targetModule)) return navigate("/module", { replace: true })
    const targetSections = buildModuleSections(allowedSections, targetModule, "employee")
    const targetMap = buildDashboardRouteMap(`/employee/${targetModule}`, targetSections)
    navigate(targetMap.reverse[`${legacy.section}::${legacy.subcategory || ""}`] || `/employee/${targetModule}`, { replace: true })
  }, [allowedSections, authChecked, currentUser, location.pathname, navigate, validModule])

  useEffect(() => {
    if (!authChecked || !currentUser || currentUser.role !== "employee" || !currentUser.isActive) return

    const cleanPath = location.pathname.replace(/\/+$/, "") || "/"
    const isCustomerDetailPath =
      cleanPath.startsWith(`${moduleBasePath}/customers/`) || cleanPath.startsWith(`${moduleBasePath}/clients/`)
    const routeIsAllowed =
      Boolean(routeMap.routes?.[cleanPath]) ||
      (isCustomerDetailPath && Boolean(moduleSections.Clients))
    const sectionIsAllowed = Boolean(moduleSections[activeSection])

    if (validModule && (!routeIsAllowed || !sectionIsAllowed)) {
      navigate(defaultEmployeePath, { replace: true })
    }
  }, [
    activeSection,
    moduleSections,
    authChecked,
    currentUser,
    defaultEmployeePath,
    location.pathname,
    navigate,
    routeMap,
    validModule,
    moduleBasePath,
  ])

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
    navigate(
      routeMap.reverse[`${section}::${subcategory}`] ||
        routeMap.reverse[`${section}::`] ||
        moduleBasePath
    )
    closeMobileSidebar()
  }

  const activeView = useMemo(() => {
    const section = moduleSections[activeSection]
    if (!section) return null
    if (section.subcategories) {
      return section.subcategories[activeSubcategory] || Object.values(section.subcategories)[0] || null
    }
    return section.component || null
  }, [activeSection, activeSubcategory, moduleSections])

  const content = useMemo(() => {
    if (activeSection === "Dashboard") {
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
    const injectedProps =
      activeSection === "Clients"
        ? {
            routeCustomerId: routeState.customerId || null,
            onNavigateCustomer: (customerId) =>
              navigate(`${moduleBasePath}/clients/${customerId}/overview`),
            onBackToCustomers: () => navigate(`${moduleBasePath}/clients`),
          }
        : {}

    if (React.isValidElement(activeView)) return React.cloneElement(activeView, injectedProps)
    if (typeof activeView === "function") {
      const Component = activeView
      return <Component {...injectedProps} />
    }
    return null
  }, [activeView, activeSection, routeState.customerId, navigate, moduleBasePath, moduleId, moduleSections, currentUser, setActiveSection])

  if (!authChecked) return <div className="h-screen w-full bg-gray-50" />

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
      />

      <main className="h-screen flex-1 overflow-auto p-5 transition-colors">
        <React.Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-gray-100" />}>{content}</React.Suspense>
      </main>

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
