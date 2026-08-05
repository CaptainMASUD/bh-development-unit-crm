import { app } from "./app.js";
import connectDB from "./db/index.js"
import dotenv from "dotenv"
import mongoose from "mongoose"
import net from "node:net"


dotenv.config({
    path : "./.env"
})

const port = Number(process.env.PORT || 4000)
const ensurePortAvailable = () => new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.unref()
    probe.once("error", reject)
    probe.listen(port, () => resolve(probe))
})

const startServer = async () => {
    let portReservation = null
    try {
        portReservation = await ensurePortAvailable()
        await connectDB()
        await new Promise((resolve, reject) => portReservation.close((error) => error ? reject(error) : resolve()))
        portReservation = null
        const server = app.listen(port, () => {
            console.log(`BusinessHub ERP API is running on port ${port}`)
        })

        server.on("error", async (error) => {
            if (error?.code === "EADDRINUSE") {
                console.error(`Port ${port} is already in use. Stop the existing API process before starting another server.`)
            } else {
                console.error("HTTP server failed to start.", error)
            }
            await mongoose.disconnect().catch(() => {})
            process.exit(1)
        })

        const shutdown = (signal) => {
            console.log(`${signal} received. Closing the API server.`)
            server.close(async () => {
                await mongoose.disconnect().catch(() => {})
                process.exit(0)
            })
        }
        process.once("SIGINT", () => shutdown("SIGINT"))
        process.once("SIGTERM", () => shutdown("SIGTERM"))
    } catch (error) {
        if (portReservation?.listening) portReservation.close()
        if (error?.code === "EADDRINUSE") {
            console.error(`Port ${port} is already in use. The existing API process is still running; do not start a second server.`)
        } else {
            console.error("MongoDB initialization failed.", error)
        }
        await mongoose.disconnect().catch(() => {})
        process.exit(1)
    }
}

startServer()


