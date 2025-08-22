import mongoose from "mongoose";

async function connectDB()
{
    try {
        await mongoose.connect(process.env.DB_URI as unknown as string,
        {
            dbName: "SocialApp",
            serverSelectionTimeoutMS: 3000
        });
        console.log("Database connected");
    } catch (error) {
        console.log("Failed to connect to Database:",error);
    }
}

export default connectDB;