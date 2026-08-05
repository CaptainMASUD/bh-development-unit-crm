import mongoose from "mongoose"
import { DB_NAME } from "../constraints.js"

let connectionPromise = null
let architecturePromise = null

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
    if (mongoose.connection.readyState !== 1) {
        if (!connectionPromise) {
            connectionPromise = mongoose.connect(databaseUri(), {
                // Production indexes and migrations are managed explicitly.
                // Letting every serverless cold start build indexes can create
                // conflicts and concurrent DDL operations.
                autoIndex: process.env.NODE_ENV !== "production",
                serverSelectionTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 10000),
            }).catch((error) => {
                connectionPromise = null
                throw error
            })
        }
        await connectionPromise
        console.log(`MongoDB connected. DB host: ${mongoose.connection.host}`)
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
