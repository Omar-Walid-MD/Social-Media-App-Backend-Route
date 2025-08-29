import type { Request, Response } from "express";
import { HUserDocument, IUser, UserModel } from "../../db/models/User.model";
import { UserRepository } from "../../db/repository/user.repository";
import { ILogoutBodyInputsDTO } from "./user.dto";
import { createLoginCredentials, createRevokeToken, LogoutEnum } from "../../utils/security/token.security";
import { UpdateQuery } from "mongoose";
import { JwtPayload } from "jsonwebtoken";

class UserService
{
    private userModel = new UserRepository(UserModel);

    constructor() {}

    profile = async(req: Request, res: Response): Promise<Response> => {

        return res.status(201).json({
            message:"Done",
            data:{
                user: req.user,
                decoded: req.decoded
            }
        });
    }

    logout = async(req: Request, res: Response): Promise<Response> => {

        const {flag}: ILogoutBodyInputsDTO = req.body;

        let statusCode: number = 200;
        const update: UpdateQuery<IUser> = {};

        switch (flag) {
            case LogoutEnum.all:
                update.changeCredentialsTime = new Date();
                break;
        
            default:
                await createRevokeToken(req.decoded as JwtPayload);
                statusCode = 201;
                break;
        }

        await this.userModel.updateOne({
            filter: {_id: req.decoded?._id},
            update
        });

        return res.status(statusCode).json({
            message:"Done",
            data:{
                user: req.user,
                decoded: req.decoded
            }
        });
    }

    refreshToken = async(req: Request, res: Response): Promise<Response> => {

        const credentials = await createLoginCredentials(req.user as HUserDocument);
        await createRevokeToken(req.decoded as JwtPayload);
        return res.status(201).json({message:"Done",data:{credentials}});
    }
    


}

export default new UserService();