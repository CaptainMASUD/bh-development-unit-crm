"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FaLightbulb,
  FaBolt,
  FaRocket,
  FaStar,
  FaTimes,
  FaClipboardCheck,
  FaTools,
  FaExclamationTriangle,
} from "react-icons/fa"

const updates = [
  {
    id: 1,
    title: "Product List Completed",
    description: "The product list feature has been fully implemented and is now ready for use.",
    type: "completed",
  },
  {
    id: 2,
    title: "Damaged Product Component",
    description: "Currently working on a new component to handle damaged product reporting and management.",
    type: "inProgress",
  },
  {
    id: 3,
    title: "Inventory Tracking Improvement",
    description: "Enhanced the inventory tracking system for more accurate stock management.",
    type: "improvement",
  },
  {
    id: 4,
    title: "Bug Fix: Price Calculation",
    description: "Fixed an issue where prices were incorrectly calculated for bulk purchases.",
    type: "fix",
  },
  {
    id: 5,
    title: "New Feature: Quick Add Products",
    description: "Implemented a quick add feature for faster product entry during busy hours.",
    type: "new",
  },
]

const iconMap = {
  new: FaRocket,
  improvement: FaLightbulb,
  fix: FaBolt,
  completed: FaClipboardCheck,
  inProgress: FaTools,
}

const UpdatesPanel = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            className="bg-white rounded-lg shadow-2xl p-6 mb-4 w-96"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-indigo-600">What's New</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <FaTimes />
              </button>
            </div>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {updates.map((update) => {
                const Icon = iconMap[update.type] || FaExclamationTriangle
                return (
                  <motion.div
                    key={update.id}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gray-50 rounded-lg p-4 shadow"
                  >
                    <div className="flex items-center mb-2">
                      <Icon
                        className={`mr-2 ${
                          update.type === "new"
                            ? "text-green-500"
                            : update.type === "improvement"
                              ? "text-blue-500"
                              : update.type === "fix"
                                ? "text-yellow-500"
                                : update.type === "completed"
                                  ? "text-purple-500"
                                  : update.type === "inProgress"
                                    ? "text-orange-500"
                                    : "text-gray-500"
                        }`}
                      />
                      <h3 className="text-lg font-semibold">{update.title}</h3>
                    </div>
                    <p className="text-gray-600">{update.description}</p>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="bg-indigo-600 text-white rounded-full p-3 shadow-lg flex items-center justify-center"
      >
        <FaStar className="mr-2" />
        <span>Updates</span>
      </motion.button>
    </div>
  )
}

export default UpdatesPanel
