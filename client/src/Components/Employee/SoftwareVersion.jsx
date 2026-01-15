"use client"

import { useState, useEffect } from "react"
import {
  FaCode,
  FaRocket,
  FaStar,
  FaCheckCircle,
  FaShieldAlt,
  FaSync,
  FaGlobe,
  FaEnvelope,
  FaBoxOpen,
  FaChartBar,
  FaUserFriends,
  FaCreditCard,
  FaCog,
  FaCloudDownloadAlt,
  FaHeadset,
  FaFingerprint,
  FaUserShield,
  FaServer,
  FaExternalLinkAlt,
  FaCheck,
  FaShoppingCart,
  FaMobileAlt,
  FaDatabase,
  FaLaptopCode,
  FaChartLine,
  FaUsersCog,
  FaRegCreditCard,
  FaMoneyBillWave,
  FaReceipt,
  FaStore,
  FaArrowRight,
  FaRegLightbulb,
} from "react-icons/fa"
import { BiSolidCheckShield } from "react-icons/bi"
import { FaShieldHalved } from "react-icons/fa6"

export default function SoftwareVersion() {
  const [activeTab, setActiveTab] = useState("features")
  const [scrolled, setScrolled] = useState(false)

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Floating icons for hero section
  const floatingIcons = [
    {
      icon: FaShoppingCart,
      top: "15%",
      left: "10%",
      size: "text-3xl",
      color: "text-indigo-300/30",
      animation: "animate-float-slow",
    },
    {
      icon: FaMobileAlt,
      top: "25%",
      left: "85%",
      size: "text-4xl",
      color: "text-purple-300/30",
      animation: "animate-float-medium",
    },
    {
      icon: FaDatabase,
      top: "65%",
      left: "15%",
      size: "text-3xl",
      color: "text-violet-300/30",
      animation: "animate-float-fast",
    },
    {
      icon: FaLaptopCode,
      top: "75%",
      left: "80%",
      size: "text-4xl",
      color: "text-indigo-300/30",
      animation: "animate-float-slow",
    },
    {
      icon: FaChartLine,
      top: "45%",
      left: "5%",
      size: "text-3xl",
      color: "text-purple-300/30",
      animation: "animate-float-medium",
    },
    {
      icon: FaRegCreditCard,
      top: "10%",
      left: "40%",
      size: "text-2xl",
      color: "text-violet-300/30",
      animation: "animate-float-fast",
    },
    {
      icon: FaMoneyBillWave,
      top: "80%",
      left: "40%",
      size: "text-3xl",
      color: "text-indigo-300/30",
      animation: "animate-float-slow",
    },
    {
      icon: FaReceipt,
      top: "30%",
      left: "70%",
      size: "text-2xl",
      color: "text-purple-300/30",
      animation: "animate-float-medium",
    },
    {
      icon: FaStore,
      top: "60%",
      left: "60%",
      size: "text-3xl",
      color: "text-violet-300/30",
      animation: "animate-float-fast",
    },
    {
      icon: FaUsersCog,
      top: "20%",
      left: "20%",
      size: "text-4xl",
      color: "text-indigo-300/30",
      animation: "animate-float-medium",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Hero Section with Premium Design */}
      <div className="relative overflow-hidden" style={{ minHeight: "650px" }}>
        {/* Premium Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1c4b] via-[#2d1b69] to-[#3b1d8c]"></div>

        {/* Animated Gradient Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_60%)]"></div>

        {/* Decorative Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 h-40 w-40 rounded-full bg-white/5 blur-3xl"></div>
          <div className="absolute bottom-10 right-10 h-60 w-60 rounded-full bg-purple-500/10 blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/10 blur-3xl"></div>
        </div>

        {/* Floating Icons */}
        <div className="absolute inset-0 overflow-hidden">
          {floatingIcons.map((item, index) => (
            <div
              key={index}
              className={`absolute ${item.animation} ${item.size} ${item.color}`}
              style={{ top: item.top, left: item.left }}
            >
              <item.icon />
            </div>
          ))}
        </div>

        {/* Subtle Pattern Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEiIGhlaWdodD0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] bg-[size:20px_20px] opacity-20"></div>

        {/* Content */}
        <div className="container relative mx-auto flex h-full min-h-[650px] flex-col items-center justify-center px-6 py-24 text-center">
          <div className="mb-6 inline-flex items-center rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
            <span className="mr-2 h-2 w-2 rounded-full bg-green-400"></span>
            <span className="text-sm font-medium text-white/90">Version 2.0.0.0</span>
          </div>

          <h1 className="mb-6 bg-gradient-to-r from-white via-purple-100 to-white bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-6xl lg:text-7xl">
            POS Software
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-violet-100/90">
            A powerful point of sale solution designed for modern businesses
          </p>

          <button className="group relative inline-flex items-center overflow-hidden rounded-full bg-white/10 px-8 py-4 text-base font-medium text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20">
            Learn More
            <FaArrowRight className="ml-2 transition-transform duration-300 group-hover:translate-x-1" />
            <span className="absolute inset-0 -z-10 translate-y-[105%] rounded-full bg-white/10 transition-transform duration-500 group-hover:translate-y-0"></span>
          </button>
        </div>

        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full">
            <path
              fill="#f8fafc"
              fillOpacity="1"
              d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"
            ></path>
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16">
        {/* Stats Section */}
        <div className="mb-20 grid grid-cols-1 gap-8 md:grid-cols-3">
          {[
            {
              icon: <FaCode className="h-7 w-7 text-blue-600" />,
              title: "Latest Release",
              value: "1.0.0.0",
              subtext: "Released: February 30, 2025",
              color: "bg-gradient-to-br from-blue-50 to-blue-100",
              valueColor: "text-blue-700",
              borderColor: "border-blue-200/50",
            },
            {
              icon: <FaRocket className="h-7 w-7 text-emerald-600" />,
              title: "Active Users",
              value: "1+",
              subtext: "Growing user base",
              color: "bg-gradient-to-br from-emerald-50 to-emerald-100",
              valueColor: "text-emerald-700",
              borderColor: "border-emerald-200/50",
            },
            {
              icon: <FaStar className="h-7 w-7 text-amber-600" />,
              title: "Customer Satisfaction",
              value: "98%",
              subtext: "Based on initial feedback",
              color: "bg-gradient-to-br from-amber-50 to-amber-100",
              valueColor: "text-amber-700",
              borderColor: "border-amber-200/50",
            },
          ].map((card, index) => (
            <div
              key={index}
              className={`group overflow-hidden rounded-2xl border ${card.borderColor} shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
            >
              <div className={`p-0 ${card.color}`}>
                <div className="flex flex-col items-center p-8">
                  <div className="mb-4 rounded-full bg-white/70 p-4 shadow-md transition-transform duration-300 group-hover:scale-110">
                    {card.icon}
                  </div>
                  <h2 className="mb-2 text-lg font-semibold text-slate-800">{card.title}</h2>
                  <p className={`mb-1 text-4xl font-bold ${card.valueColor}`}>{card.value}</p>
                  <p className="text-center text-sm text-slate-600">{card.subtext}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs Section */}
        <div className="mb-20">
          <div className="mb-12 flex justify-center">
            <div className="grid w-full max-w-md grid-cols-3 rounded-full bg-slate-100/80 p-1.5 backdrop-blur-sm">
              {["features", "security", "support"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-300 ${
                    activeTab === tab ? "bg-white text-slate-900 shadow-md" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "features" && (
            <div className="rounded-2xl border border-slate-200/70 bg-white p-8 shadow-xl">
              <h2 className="mb-10 flex items-center text-2xl font-bold text-slate-800">
                <FaCheckCircle className="mr-3 h-6 w-6 text-violet-600" />
                Key Features
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    icon: <FaBoxOpen className="h-5 w-5 text-violet-600" />,
                    title: "Real-time Inventory",
                    description: "Track stock levels instantly across all locations",
                  },
                  {
                    icon: <FaChartBar className="h-5 w-5 text-violet-600" />,
                    title: "Advanced Analytics",
                    description: "Gain insights with powerful reporting tools",
                  },
                  {
                    icon: <FaUserFriends className="h-5 w-5 text-violet-600" />,
                    title: "Multi-store Support",
                    description: "Manage multiple locations from a single dashboard",
                  },
                  {
                    icon: <FaStar className="h-5 w-5 text-violet-600" />,
                    title: "Loyalty Program",
                    description: "Reward customers and boost retention",
                  },
                  {
                    icon: <FaCreditCard className="h-5 w-5 text-violet-600" />,
                    title: "Integrated Payments",
                    description: "Seamless and secure transaction processing",
                  },
                  {
                    icon: <FaCog className="h-5 w-5 text-violet-600" />,
                    title: "Customizable",
                    description: "Tailor the system to your specific business needs",
                  },
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="group rounded-xl border border-slate-200/70 bg-slate-50/50 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-start gap-4 p-6">
                      <div className="rounded-lg bg-violet-100 p-3 shadow-sm transition-colors group-hover:bg-violet-200">
                        {feature.icon}
                      </div>
                      <div>
                        <h3 className="mb-2 text-lg font-semibold text-slate-800">{feature.title}</h3>
                        <p className="text-sm text-slate-600">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="rounded-2xl border border-slate-200/70 bg-white p-8 shadow-xl">
              <h2 className="mb-10 flex items-center text-2xl font-bold text-slate-800">
                <FaShieldAlt className="mr-3 h-6 w-6 text-violet-600" />
                Security Measures
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    icon: <FaFingerprint className="h-5 w-5 text-blue-600" />,
                    title: "End-to-end Encryption",
                    description: "All data is encrypted in transit and at rest",
                  },
                  {
                    icon: <FaUserShield className="h-5 w-5 text-blue-600" />,
                    title: "Two-factor Authentication",
                    description: "Extra layer of security for all user accounts",
                  },
                  {
                    icon: <BiSolidCheckShield className="h-5 w-5 text-blue-600" />,
                    title: "Regular Security Audits",
                    description: "Continuous monitoring and vulnerability testing",
                  },
                  {
                    icon: <FaShieldHalved className="h-5 w-5 text-blue-600" />,
                    title: "PCI DSS Compliant",
                    description: "Meets all payment card industry security standards",
                  },
                  {
                    icon: <FaServer className="h-5 w-5 text-blue-600" />,
                    title: "Data Backup & Recovery",
                    description: "Automated backups with quick disaster recovery",
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="group rounded-xl border border-slate-200/70 bg-slate-50/50 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-start gap-4 p-6">
                      <div className="rounded-lg bg-blue-100 p-3 shadow-sm transition-colors group-hover:bg-blue-200">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="mb-2 text-lg font-semibold text-slate-800">{item.title}</h3>
                        <p className="text-sm text-slate-600">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "support" && (
            <div className="rounded-2xl border border-slate-200/70 bg-white p-8 shadow-xl">
              <h2 className="mb-10 flex items-center text-2xl font-bold text-slate-800">
                <FaSync className="mr-3 h-6 w-6 text-violet-600" />
                Updates and Support
              </h2>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-lg">
                  <h3 className="mb-6 flex items-center text-xl font-semibold text-slate-800">
                    <FaCloudDownloadAlt className="mr-2 h-5 w-5 text-emerald-600" /> Update Policy
                  </h3>
                  <ul className="space-y-4">
                    {[
                      "Automatic updates with zero downtime",
                      "Regular feature enhancements based on user feedback",
                      "Security patches within 24 hours of discovery",
                      "Detailed release notes for all updates",
                    ].map((item, index) => (
                      <li
                        key={index}
                        className="flex items-center rounded-lg bg-white/80 p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                      >
                        <div className="mr-3 rounded-full bg-emerald-100 p-1.5">
                          <FaCheck className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 p-6 shadow-lg">
                  <h3 className="mb-6 flex items-center text-xl font-semibold text-slate-800">
                    <FaHeadset className="mr-2 h-5 w-5 text-violet-600" /> Customer Support
                  </h3>
                  <ul className="space-y-4">
                    {[
                      "24/7 live chat and email support with fast response times",
                      "Dedicated account managers for enterprise clients",
                      "Comprehensive knowledge base and video tutorials",
                      "Regular training sessions and webinars",
                    ].map((item, index) => (
                      <li
                        key={index}
                        className="flex items-center rounded-lg bg-white/80 p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                      >
                        <div className="mr-3 rounded-full bg-violet-100 p-1.5">
                          <FaCheck className="h-3.5 w-3.5 text-violet-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* About Section */}
        <div className="mb-20 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-xl">
          <div className="bg-gradient-to-r from-indigo-50 to-violet-50 p-10">
            <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-6 inline-flex items-center rounded-full bg-indigo-100 px-3 py-1">
                  <FaRegLightbulb className="mr-2 h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-700">About Us</span>
                </div>
                <h2 className="mb-6 text-3xl font-bold text-slate-800">About Captains IT</h2>
                <p className="mb-8 max-w-2xl text-slate-600">
                  At Captains IT, we have extensive experience in developing innovative IT solutions. Our expertise
                  includes building robust POS systems, inventory management solutions, SaaS platforms, and more. We are
                  committed to delivering high-quality, scalable, and efficient software tailored to meet the unique
                  needs of businesses.
                </p>
                <div className="mb-6 flex flex-wrap gap-2">
                  {["Innovative Solutions", "Scalable Software", "Tailored Approach"].map((badge, index) => (
                    <span
                      key={index}
                      className={`inline-flex rounded-full px-4 py-1.5 text-sm font-medium shadow-sm ${
                        index === 0
                          ? "bg-indigo-100 text-indigo-700"
                          : index === 1
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4 md:min-w-[220px]">
                <a
                  href="https://captains-it.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-xl"
                >
                  <FaGlobe className="mr-2 h-4 w-4" /> Visit Website
                  <FaExternalLinkAlt className="ml-2 h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
                <button className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-slate-700 shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-slate-50 hover:shadow-lg">
                  <FaEnvelope className="mr-2 h-4 w-4" /> Contact Us
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 p-10 text-center shadow-2xl">
          {/* Decorative Elements */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 h-40 w-40 rounded-full bg-white/5 blur-3xl"></div>
            <div className="absolute bottom-0 right-0 h-60 w-60 rounded-full bg-purple-500/10 blur-3xl"></div>
          </div>

          <div className="relative">
            <h2 className="mb-6 text-4xl font-bold text-white">Ready to transform your business?</h2>
            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-violet-100">
              Join the growing number of businesses that trust our POS solution to streamline their operations.
            </p>
            <button className="group relative inline-flex items-center overflow-hidden rounded-full bg-white px-8 py-4 text-base font-medium text-violet-700 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              Get Started
              <FaArrowRight className="ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              <span className="absolute inset-0 -z-10 translate-y-[105%] rounded-full bg-violet-50 transition-transform duration-500 group-hover:translate-y-0"></span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-16">
        <div className="container mx-auto px-6 text-center">
          <p className="mb-4 text-slate-600">Need assistance? Contact our support team</p>
          <a
            href="mailto:captainsit9@gmail.com"
            className="inline-flex items-center text-lg font-medium text-violet-600 transition-colors hover:text-violet-700"
          >
            <FaEnvelope className="mr-2 h-5 w-5" /> captainsit9@gmail.com
          </a>
          <p className="mt-8 text-sm text-slate-500">© {new Date().getFullYear()} Captains IT. All rights reserved.</p>
        </div>
      </footer>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-float-slow {
          animation: float-slow 6s ease-in-out infinite;
        }
        .animate-float-medium {
          animation: float-medium 4s ease-in-out infinite;
        }
        .animate-float-fast {
          animation: float-fast 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
