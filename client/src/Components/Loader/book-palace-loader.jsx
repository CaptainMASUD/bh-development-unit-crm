"use client"

import { motion } from "framer-motion"
import { BookOpen } from "lucide-react"

export default function BookPalaceLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-white">
      <div className="relative flex flex-col items-center">
        {/* Animated books stack */}
        <div className="relative h-24 w-24 mb-4">
          {/* Book 1 */}
          <motion.div
            className="absolute left-0 right-0 mx-auto w-16 h-5 bg-gradient-to-r from-purple-800 to-purple-600 rounded-sm shadow-md"
            initial={{ y: 0 }}
            animate={{
              y: [0, -15, 0],
              rotateX: [0, 15, 0],
              z: [0, 30, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              delay: 0,
              ease: "easeInOut",
            }}
          />

          {/* Book 2 */}
          <motion.div
            className="absolute left-0 right-0 mx-auto w-16 h-5 bg-gradient-to-r from-purple-700 to-purple-500 rounded-sm shadow-md"
            initial={{ y: 6 }}
            animate={{
              y: [6, -9, 6],
              rotateX: [0, 15, 0],
              z: [0, 30, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              delay: 0.2,
              ease: "easeInOut",
            }}
          />

          {/* Book 3 */}
          <motion.div
            className="absolute left-0 right-0 mx-auto w-16 h-5 bg-gradient-to-r from-purple-600 to-purple-400 rounded-sm shadow-md"
            initial={{ y: 12 }}
            animate={{
              y: [12, -3, 12],
              rotateX: [0, 15, 0],
              z: [0, 30, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              delay: 0.4,
              ease: "easeInOut",
            }}
          />

          {/* Book 4 */}
          <motion.div
            className="absolute left-0 right-0 mx-auto w-16 h-5 bg-gradient-to-r from-purple-500 to-purple-300 rounded-sm shadow-md"
            initial={{ y: 18 }}
            animate={{
              y: [18, 3, 18],
              rotateX: [0, 15, 0],
              z: [0, 30, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              delay: 0.6,
              ease: "easeInOut",
            }}
          />

          {/* Book 5 */}
          <motion.div
            className="absolute left-0 right-0 mx-auto w-16 h-5 bg-gradient-to-r from-purple-400 to-purple-200 rounded-sm shadow-md"
            initial={{ y: 24 }}
            animate={{
              y: [24, 9, 24],
              rotateX: [0, 15, 0],
              z: [0, 30, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              delay: 0.8,
              ease: "easeInOut",
            }}
          />

          {/* Bookshelf */}
          <div className="absolute top-[30px] w-24 h-2.5 bg-gradient-to-r from-purple-900 via-purple-700 to-purple-900 rounded-sm left-0 right-0 mx-auto shadow-lg"></div>
        </div>

        {/* Floating particles (book pages) */}
        <div className="absolute w-40 h-40">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className={`absolute w-${i % 3 === 0 ? "3" : "2"} h-${i % 3 === 0 ? "3" : "2"} bg-purple-${i % 2 === 0 ? "200" : "100"} rounded-sm opacity-70`}
              initial={{
                x: Math.random() * 80 - 40,
                y: Math.random() * 80 - 40,
                opacity: 0,
                rotate: Math.random() * 180,
              }}
              animate={{
                y: [null, -50],
                x: [null, Math.random() * 30 - 15],
                opacity: [0, 0.9, 0],
                rotate: [null, Math.random() * 360],
              }}
              transition={{
                duration: 2 + Math.random() * 1.5,
                repeat: Number.POSITIVE_INFINITY,
                delay: Math.random() * 2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* Book icon in the center */}
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            rotate: [0, 5, 0, -5, 0],
          }}
          transition={{
            duration: 3,
            ease: "easeInOut",
            repeat: Number.POSITIVE_INFINITY,
          }}
          className="text-purple-700 z-10 bg-white bg-opacity-90 rounded-full p-3.5 shadow-lg"
        >
          <BookOpen size={34} strokeWidth={2.5} />
        </motion.div>
      </div>

      {/* Text with gradient */}
      <motion.div
        className="mt-12 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <motion.h1
          className="text-3xl font-bold bg-gradient-to-r from-purple-700 via-purple-500 to-purple-700 bg-clip-text text-transparent"
          animate={{
            backgroundPosition: ["0% center", "100% center", "0% center"],
          }}
          transition={{
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          Book Palace
        </motion.h1>

        {/* Infinite left-to-right and right-to-left loader */}
        <div className="mt-4 w-48 h-2 bg-purple-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full w-24 bg-gradient-to-r from-transparent via-purple-600 to-transparent"
            animate={{
              x: [-100, 148, -100],
            }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
              repeatType: "loop",
            }}
          />
        </div>

        {/* Loading text */}
        <motion.p
          className="mt-2 text-sm text-purple-600 font-medium"
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          Loading your literary world
        </motion.p>
      </motion.div>
    </div>
  )
}

