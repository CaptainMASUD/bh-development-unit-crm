"use client"

import { useState } from "react"
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaUserShield,
  FaUserTie,
  FaBullhorn,
} from "react-icons/fa"
import { RiShieldStarFill } from "react-icons/ri"
import { useNavigate } from "react-router-dom"
import axios from "axios"

export default function RegisterForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("employee")
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const navigate = useNavigate()

  const handleRegister = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/users/register`, {
        name,
        email,
        password,
        role, // supports: employee | admin | superadmin | marketing_team
      })

      if (res.status === 201 || res.status === 200) {
        setSuccess("Account created successfully. Please login.")
        setTimeout(() => navigate("/login"), 900)
      } else {
        setError("Unexpected response from server.")
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Registration failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 p-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-purple-600 opacity-20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-30%] right-[20%] w-[700px] h-[700px] bg-blue-600 opacity-20 blur-[140px] rounded-full" />
      </div>

      <div className="relative w-full max-w-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-2xl blur-xl transform -rotate-3 scale-105" />

        <div className="relative bg-gray-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-4 rounded-2xl shadow-lg mb-4">
              <FaUserTie className="text-4xl text-white" />
            </div>
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
              CRM Register
            </h2>
            <p className="text-gray-400 mt-1">Create a new account</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-gray-300 block pl-1">
                  Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <FaUser className="text-gray-400" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 w-full bg-gray-800/50 border border-gray-700 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300"
                    placeholder="Full name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-300 block pl-1">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <FaEnvelope className="text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 w-full bg-gray-800/50 border border-gray-700 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300"
                    placeholder="Email address"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-300 block pl-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <FaLock className="text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 w-full bg-gray-800/50 border border-gray-700 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300"
                    placeholder="Create a password"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 block pl-1">Role</label>

                {/* ✅ 4 roles now */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("employee")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg border transition-all duration-300 ${
                      role === "employee"
                        ? "bg-purple-600/20 border-purple-500 text-white"
                        : "bg-gray-800/50 border-gray-700 text-gray-300 hover:text-white"
                    }`}
                  >
                    <FaUserTie />
                    Employee
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("marketing_team")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg border transition-all duration-300 ${
                      role === "marketing_team"
                        ? "bg-emerald-600/20 border-emerald-500 text-white"
                        : "bg-gray-800/50 border-gray-700 text-gray-300 hover:text-white"
                    }`}
                    title="Marketing Team"
                  >
                    <FaBullhorn />
                    Marketing
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("admin")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg border transition-all duration-300 ${
                      role === "admin"
                        ? "bg-blue-600/20 border-blue-500 text-white"
                        : "bg-gray-800/50 border-gray-700 text-gray-300 hover:text-white"
                    }`}
                  >
                    <FaUserShield />
                    Admin
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("superadmin")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg border transition-all duration-300 ${
                      role === "superadmin"
                        ? "bg-amber-500/20 border-amber-400 text-white"
                        : "bg-gray-800/50 border-gray-700 text-gray-300 hover:text-white"
                    }`}
                    title="Super Admin (full access)"
                  >
                    <RiShieldStarFill />
                    Super
                  </button>
                </div>

                <p className="text-[11px] text-gray-500 mt-2">
                  Note: You said you’ll secure role selection later (currently open).
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 shadow-lg shadow-purple-600/20 flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-gray-400 text-sm">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-purple-400 hover:text-purple-300 hover:underline transition-colors font-medium"
            >
              Sign in
            </button>
          </div>

          <div className="mt-8 pt-4 border-t border-gray-800 text-center text-gray-400 text-xs">
            &copy; {new Date().getFullYear()} CRM System. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  )
}
