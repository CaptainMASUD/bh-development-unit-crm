"use client"

import { useMemo } from "react"
import { useSelector } from "react-redux"
import { FiBarChart2, FiLock } from "react-icons/fi"
import { PERMISSIONS, hasPermission } from "../Auth/permissions"
import DashboardContent from "./DashboardContent"
import LeadOperationsDashboard from "./LeadOperationsDashboard"

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null")
  } catch {
    return null
  }
}

export default function UnifiedDashboard() {
  const reduxUser = useSelector((state) => state.user?.currentUser)
  const user = useMemo(() => reduxUser || getStoredUser(), [reduxUser])
  const canViewCustomers = hasPermission(user, PERMISSIONS.CUSTOMERS_VIEW)
  const canViewLeads = hasPermission(user, PERMISSIONS.LEADS_VIEW)

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_14px_38px_-28px_rgba(15,23,42,0.45)]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <FiBarChart2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-950">Dashboard</h1>
              <p className="text-sm font-medium text-gray-500">
                Your available client and lead activity in one place.
              </p>
            </div>
          </div>
        </div>

        {canViewCustomers ? (
          <DashboardContent embedded />
        ) : null}

        {canViewLeads ? (
          <LeadOperationsDashboard embedded />
        ) : null}

        {!canViewCustomers && !canViewLeads ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-[0_14px_38px_-28px_rgba(15,23,42,0.45)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
              <FiLock className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold text-gray-950">No dashboard data available</h2>
            <p className="mt-1 text-sm font-medium text-gray-500">
              Client or lead access is required before dashboard data can be shown.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
