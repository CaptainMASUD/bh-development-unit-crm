"use client"

import { useState } from "react"
import {
  FaUser,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaHeadset,
  FaTimes,
  FaEnvelope,
  FaGlobe,
  FaDiscord,
} from "react-icons/fa"
import { motion, AnimatePresence } from "framer-motion"
import { useDispatch, useSelector } from "react-redux"
import { signInStart, signInSuccess, signInError } from "../../Redux/UserSlice/UserSlice"
import { useNavigate } from "react-router-dom"
import axios from "axios"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)

  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { error, loading } = useSelector((state) => state.user)

  const handleLogin = async (e) => {
    e.preventDefault()
    dispatch(signInStart())

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/users/login`, {
        email,
        password,
      })

      if (response.status === 200 && response.data?.user?.role) {
        const user = response.data.user
        const token = response.data.token

        if (!user.isActive) {
          throw new Error("User account is inactive. Please contact admin.")
        }

        dispatch(signInSuccess(user))

        localStorage.setItem("user", JSON.stringify(user))
        if (token) localStorage.setItem("token", token)

        // ✅ admin + superadmin go to same route
        if (user.role === "admin" || user.role === "superadmin") {
          navigate("/admin")
          return
        }

        if (user.role === "employee") {
          navigate("/employee")
          return
        }

        // ✅ NEW: marketing team route
        if (user.role === "marketing_team") {
          navigate("/marketing")
          return
        }

        throw new Error("Invalid role received from server.")
      } else {
        throw new Error("Unexpected response from server.")
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || err.message || "Login failed. Please try again."
      dispatch(signInError(errorMessage))
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 p-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-purple-600 opacity-20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-30%] right-[20%] w-[700px] h-[700px] bg-blue-600 opacity-20 blur-[140px] rounded-full" />
      </div>

      <button
        onClick={() => setShowSupportModal(true)}
        className="absolute top-6 right-6 flex items-center gap-2 bg-gray-800/50 hover:bg-gray-700/60 backdrop-blur-sm text-gray-300 hover:text-white py-2 px-4 rounded-full transition-all duration-300 border border-gray-700/50"
      >
        <FaHeadset className="text-lg" />
        <span className="text-sm font-medium">Support</span>
      </button>

      <AnimatePresence>
        {showSupportModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowSupportModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-gray-900/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl text-white w-full max-w-md border border-gray-700/50 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowSupportModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes className="text-xl" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="bg-purple-500/20 p-3 rounded-full">
                  <FaHeadset className="text-2xl text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">CRM Support</h2>
              </div>

              <p className="text-gray-300 mb-6">
                Need help? Contact our support team through any channel below.
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <FaGlobe className="text-blue-400 text-lg" />
                  <div>
                    <p className="text-sm text-gray-400">Website</p>
                    <a
                      href="https://captains-it.vercel.app/"
                      className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                    >
                      https://captains-it.vercel.app/
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <FaEnvelope className="text-green-400 text-lg" />
                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <a
                      href="mailto:captainsit9@gmail.com"
                      className="text-green-400 hover:text-green-300 hover:underline transition-colors"
                    >
                      captainsit9@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <FaDiscord className="text-[#5865F2] text-lg" />
                  <div>
                    <p className="text-sm text-gray-400">Discord</p>
                    <a
                      href="https://discord.gg/AcPtVpFssh"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5865F2] hover:text-[#7289DA] hover:underline transition-colors"
                    >
                      Join Captains IT
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-700/50 text-center">
                <span className="px-4 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-full text-sm font-medium">
                  24/7 Support
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-2xl blur-xl transform -rotate-3 scale-105"></div>

        <div className="relative bg-gray-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-4 rounded-2xl shadow-lg mb-4">
              <FaUser className="text-4xl text-white" />
            </div>
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
              CRM System
            </h2>
            <p className="text-gray-400 mt-1">Sign in to your account</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
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
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

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
                  placeholder="Enter your password"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 shadow-lg shadow-purple-600/20 flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-8 pt-4 border-t border-gray-800 text-center text-gray-400 text-xs">
            &copy; {new Date().getFullYear()} CRM System. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  )
}
