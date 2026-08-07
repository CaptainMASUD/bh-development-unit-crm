import { app } from "./app.js";
import connectDB from "./db/index.js"
import dotenv from "dotenv"
import mongoose from "mongoose"


dotenv.config({
    path : "./.env"
})

const port = Number(process.env.PORT || 4000)
const isVercel = Boolean(process.env.VERCEL)
let activeServer = null
let shuttingDown = false

const listen = () => new Promise((resolve, reject) => {
    const server = app.listen(port)
    server.once("listening", () => resolve(server))
    server.once("error", reject)
})

const shutdown = async (signal, exitCode = 0) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`${signal} received. Closing the API server.`)

    const forceExit = setTimeout(() => {
        console.error("Graceful shutdown timed out.")
        process.exit(1)
    }, 10_000)
    forceExit.unref()

    if (activeServer?.listening) {
        await new Promise((resolve) => activeServer.close(() => resolve()))
    }
    await mongoose.disconnect().catch(() => {})
    clearTimeout(forceExit)
    process.exit(exitCode)
}

const startServer = async () => {
    try {
        await connectDB({ initializeArchitecture: true })
        activeServer = await listen()
        activeServer.keepAliveTimeout = numberFromEnv("HTTP_KEEP_ALIVE_TIMEOUT_MS", 65_000)
        activeServer.headersTimeout = Math.max(
            numberFromEnv("HTTP_HEADERS_TIMEOUT_MS", 66_000),
            activeServer.keepAliveTimeout + 1_000
        )
        activeServer.requestTimeout = numberFromEnv("HTTP_REQUEST_TIMEOUT_MS", 120_000)
        console.log(`BusinessHub ERP API is running on port ${port}`)
    } catch (error) {
        if (error?.code === "EADDRINUSE") {
            console.error(`Port ${port} is already in use. The existing API process is still running; do not start a second server.`)
        } else {
            console.error("MongoDB initialization failed.", error)
        }
        await mongoose.disconnect().catch(() => {})
        process.exit(1)
    }
}

const numberFromEnv = (name, fallback) => {
    const value = Number(process.env[name])
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback
}

// Vercel owns the HTTP listener. Exporting a request handler prevents a
// serverless invocation from binding a port, registering shutdown hooks, or
// terminating the worker with process.exit(). The cached connection promise
// is reused by warm invocations.
const handler = async (req, res) => {
    // CORS preflight does not need MongoDB. Keeping it database-independent
    // also lets the browser receive the correct 204 response during a brief
    // database outage.
    if (req.method === "OPTIONS") return app(req, res)

    // Liveness and the service landing page must still respond when MongoDB is
    // temporarily unavailable. Readiness intentionally performs the DB check.
    const pathname = String(req.url || "").split("?", 1)[0]
    if (pathname === "/" || pathname === "/api/health") return app(req, res)

    try {
        await connectDB()
        return app(req, res)
    } catch (error) {
        console.error("Request database initialization failed.", error)
        if (res.headersSent) return undefined
        return res.status(503).json({
            success: false,
            statusCode: 503,
            message: "The database is temporarily unavailable.",
        })
    }
}

if (!isVercel) {
    process.once("SIGINT", () => shutdown("SIGINT"))
    process.once("SIGTERM", () => shutdown("SIGTERM"))
    process.once("uncaughtException", (error) => {
        console.error("Uncaught exception.", error)
        void shutdown("uncaughtException", 1)
    })
    process.once("unhandledRejection", (reason) => {
        console.error("Unhandled promise rejection.", reason)
        void shutdown("unhandledRejection", 1)
    })
    void startServer()
}

export default handler
export { handler, startServer }


