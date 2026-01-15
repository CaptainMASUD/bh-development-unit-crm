import mongoose from "mongoose"
import { DB_NAME } from "../constraints.js"

const connectDB = async () =>{
    try {
        const coneectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        console.log(`MongoDB conneted !! DB HOST ${coneectionInstance.connection.host}`);
    } catch (error) {
        console.log(`MongoDB connection failed! `,error);
        process.exit(1)
    }
    
}

export default connectDB;