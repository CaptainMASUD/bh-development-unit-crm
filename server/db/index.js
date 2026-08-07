import mongoose from "mongoose"
import { DB_NAME } from "../constraints.js"
import {
    getMongoTransactionCapability,
    resetMongoTransactionCapability,
} from "../utils/mongoTransaction.js"

let connectionPromise = null
let architecturePromise = null
let listenersRegistered = false

const numberFromEnv = (name, fallback, minimum = 0) => {
    const value = Number(process.env[name])
    return Number.isFinite(value) ? Math.max(Math.trunc(value), minimum) : fallback
}

const registerConnectionListeners = () => {
    if (listenersRegistered) return
    listenersRegistered = true
    mongoose.connection.on("disconnected", () => {
        connectionPromise = null
        resetMongoTransactionCapability()
        console.warn("MongoDB disconnected; the next request will reconnect.")
    })
    mongoose.connection.on("error", (error) => {
        console.error("MongoDB connection error.", error?.message || error)
    })
}

const databaseUri = () => {
    const baseUri = String(process.env.MONGODB_URL || "").trim()
    if (!baseUri) {
        throw new Error("MONGODB_URL is not configured.")
    }

    // Preserve query parameters when the configured URI does not already
    // contain a database name (for example mongodb+srv://host/?retryWrites=true).
    const queryIndex = baseUri.indexOf("?")
    const uriWithoutQuery = queryIndex >= 0 ? baseUri.slice(0, queryIndex) : baseUri
    const query = queryIndex >= 0 ? baseUri.slice(queryIndex) : ""
    const authorityEnd = uriWithoutQuery.indexOf("/", uriWithoutQuery.indexOf("//") + 2)
    const hasDatabaseName = authorityEnd >= 0 && uriWithoutQuery.slice(authorityEnd + 1).length > 0
    if (hasDatabaseName) return baseUri

    return `${uriWithoutQuery.replace(/\/$/, "")}/${DB_NAME}${query}`
}

const connectDB = async ({ initializeArchitecture = false } = {}) => {
    registerConnectionListeners()
    if (mongoose.connection.readyState !== 1) {
        if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
            connectionPromise = null
        }
        if (!connectionPromise) {
            const serverless = Boolean(process.env.VERCEL)
            connectionPromise = mongoose.connect(databaseUri(), {
                // Production indexes and migrations are managed explicitly.
                // Letting every serverless cold start build indexes can create
                // conflicts and concurrent DDL operations.
                autoIndex: process.env.NODE_ENV !== "production",
                maxPoolSize: numberFromEnv("MONGODB_MAX_POOL_SIZE", serverless ? 10 : 30, 1),
                minPoolSize: numberFromEnv("MONGODB_MIN_POOL_SIZE", 0),
                maxIdleTimeMS: numberFromEnv("MONGODB_MAX_IDLE_TIME_MS", serverless ? 60_000 : 120_000, 1_000),
                serverSelectionTimeoutMS: numberFromEnv("MONGODB_CONNECT_TIMEOUT_MS", 10_000, 1_000),
                connectTimeoutMS: numberFromEnv("MONGODB_CONNECT_TIMEOUT_MS", 10_000, 1_000),
                socketTimeoutMS: numberFromEnv("MONGODB_SOCKET_TIMEOUT_MS", 45_000, 1_000),
                waitQueueTimeoutMS: numberFromEnv("MONGODB_WAIT_QUEUE_TIMEOUT_MS", 10_000, 1_000),
                retryWrites: true,
                retryReads: true,
            }).catch((error) => {
                connectionPromise = null
                resetMongoTransactionCapability()
                throw error
            })
        }
        await connectionPromise
        if (mongoose.connection.readyState !== 1) {
            connectionPromise = null
            throw new Error("MongoDB connection did not reach the connected state.")
        }
        console.log(`MongoDB connected. DB host: ${mongoose.connection.host}`)
        const transactionCapability = await getMongoTransactionCapability({ refresh: true })
        console.log(
            `MongoDB transaction mode: ${transactionCapability.supported ? "transactional" : "standalone fallback"} (${transactionCapability.topology})`
        )
    }

    if (initializeArchitecture && !architecturePromise) {
        architecturePromise = import("../services/tenant.service.js")
            .then(({ initializeTenantArchitecture }) => initializeTenantArchitecture())
            .catch((error) => {
                architecturePromise = null
                throw error
            })
    }
    if (initializeArchitecture) await architecturePromise

    return mongoose
}

export default connectDB;
