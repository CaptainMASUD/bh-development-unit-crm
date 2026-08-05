import mongoose from "mongoose"
import { DB_NAME } from "../constraints.js"

const connectDB = async () =>{
    const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
    const { initializeTenantArchitecture } = await import("../services/tenant.service.js")
    await initializeTenantArchitecture()
    console.log(`MongoDB connected. DB host: ${connectionInstance.connection.host}`)
    return connectionInstance
}

export default connectDB;
