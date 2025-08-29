import {connect} from "mongoose";
import { UserModel } from "./models/User.model";

async function connectDB(): Promise<void>
{
    try {
        const result = await connect(process.env.DB_URI as string,
        {
            dbName: "SocialApp",
            serverSelectionTimeoutMS: 3000
        });

        await UserModel.syncIndexes();

        console.log("Database connected");
        console.log(result.models);
    } catch (error) {
        console.log("Failed to connect to Database:",error);
    }
}

export default connectDB;