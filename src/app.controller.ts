import type {Request, Response, Express} from "express";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import {rateLimit} from "express-rate-limit";

import { resolve } from "node:path";
import { config } from "dotenv";
config({
    path: resolve("./config/.env.dev")
});

import authController from "./modules/auth/auth.controller";
import userController from "./modules/user/user.controller";
import { globalErrorHandling } from "./utils/response/error.response";
import connectDB from "./db/connection.db";

const limiter = rateLimit({
    windowMs: 60 * 60000,
    limit: 2000,
    message: {error: "Too many requests"},
    statusCode: 429
});

const bootstrap = async (): Promise<void> => {
    
    const app: Express = express();
    app.use(cors(), express.json(), helmet());
    app.use(limiter);

    app.get("/",(req: Request,res: Response)=>{
        res.json({message:`Welcome to ${process.env.APPLICATION_NAME} landing page`});
    });

    await connectDB();

    //modules
    app.use("/auth",authController);
    app.use("/user",userController);

    app.use("{/*dummy}",(req:Request,res:Response)=>{
        return res.status(404).json({message:"Invalid Routing"});
    });

    app.use(globalErrorHandling);

    const port: number | string = process.env.PORT || 3000;
    app.listen(port,()=>{
        console.log(`Server is listening at port: ${port}`)
    })
}

export default bootstrap;