import type { Request, Response } from "express";
import * as DBService from "../../db/service/db.service";
import { UserModel } from "../../db/models/User.model";
import { ApplicationException, NotFoundException } from "../../utils/response/error.response";
import { compareHash, generateHash } from "../../utils/security/hash.security";
import nanoid from "nanoid";
import { emailEvent } from "../../utils/events/email.events";
import { generateEncryption } from "../../utils/security/encryption.security";
import { generateLoginCredentials } from "../../utils/security/token.security";

class AuthenticationService
{
    constructor()
    {
        
    }

    signup = async (req: Request,res: Response): Promise<Response> =>
    {
        const {username,email,password,phone} = req.body;

        if(await DBService.findOne({model:UserModel,filter:{email}}))
        {
            throw new ApplicationException("Email Exists",409);
        }

        const hashPassword = await generateHash({plaintext:password});
        const encPhone = await generateEncryption({plaintext:phone});

        const otp = nanoid.customAlphabet("0123456789",6)();
        const confirmEmailOtp = {
            otp: await generateHash({plaintext:otp}),
            attempts: 0,
            retryDate: null,
            expirationDate: Date.now() + 2*60*1000
        }


        const user = await DBService.create({
            model: UserModel,
            data: [{username,email,password:hashPassword,phone:encPhone,confirmEmailOtp}]
        });

        emailEvent.emit("confirmEmail",{
            to: email,
            otp
        });

        return res.status(201).json({message:"Done",data:{user}});
    };

    login = async (req: Request,res: Response): Promise<Response> =>
    {
        const {email,password} = req.body;
    
        const user = await DBService.findOne({
            model:UserModel,
            filter:{ email }
        });

        if(!user)
        {
            throw new NotFoundException("Invalid Login data");
        }
        if(!user.confirmEmail)
        {
            throw new ApplicationException("Please verify your account first");
        }
        
        if(!await compareHash({plaintext:password,hashValue:user.password}))
        {
            throw new NotFoundException("Invalid Login data");
        }

        const credentials = await generateLoginCredentials({user});

        return res.json({message:"Done",data:{credentials}});
    };


    confirmEmail = async (req: Request, res: Response): Promise<Response> =>
    {
        const {email,otp} = req.body;

        const user = await DBService.findOne({
            model: UserModel,
            filter: {
                email,
                confirmEmail: {
                    $exists: false
                },
                confirmEmailOtp: {
                    $exists: true
                }
            }
        });

        if(!user) throw new NotFoundException("Invalid account or already verified");

        if(user.confirmEmailOtp.retryDate)
        {
            // if ban expired
            if(user.confirmEmailOtp.retryDate <= Date.now())
            {
                await DBService.updateOne({
                    model: UserModel,
                    filter: {email},
                    update: {
                        $set: {"confirmEmailOtp.attempts":0,"confirmEmailOtp.retryDate":null}
                    }
                });
            }
            // if user is still banned from making requests
            else
            {
                const minutesLeft = Math.ceil((user.confirmEmailOtp.retryDate - Date.now()) / 1000 / 60);
                throw new ApplicationException(`Too many attempts. Please retry again after ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}.`);
            }
        }

        // if otp is invalid or expired
        if(!await compareHash({plaintext:otp,hashValue:user.confirmEmailOtp.otp}) || user.confirmEmailOtp.expirationDate < Date.now())
        {
            await DBService.updateOne({
                model: UserModel,
                filter: {email},
                update: {
                    $inc: {"confirmEmailOtp.attempts":1},
                    $set: {"confirmEmailOtp.retryDate": user.confirmEmailOtp.attempts === 4 ? Date.now()+5*60*1000 : null }
                }
            });

            throw new ApplicationException("Invalid or Expired OTP");
        }

        const updatedUser = await DBService.updateOne({
            model: UserModel,
            filter: {email},
            update: {
                confirmEmail: Date.now(),
                $unset: {confirmEmailOtp: true},
                $inc: {__v: 1}
            }
        });

        if(!updatedUser) throw new ApplicationException("Fail to confirm user email");

        return res.status(201).json({message:"Done"});

    };


    resendEmail = async (req: Request,res: Response) => {

        const {email} = req.body;

        const user = await DBService.findOne({
            model: UserModel,
            filter: {
                email,
                confirmEmail: {
                    $exists: false
                },
                confirmEmailOtp: {
                    $exists: true
                }
            }
        });

        if(!user) throw new NotFoundException("Invalid account or already verified");

        const otp = nanoid.customAlphabet("0123456789",6)();

        const confirmEmailOtpUpdate = {
            otp: await generateHash({plaintext:otp}),
            expirationDate: Date.now() + 2*60*1000
        }

        await DBService.updateOne({
            model: UserModel,
            filter: {email},
            update: {
                $set: {
                    "confirmEmailOtp.otp":confirmEmailOtpUpdate.otp,
                    "confirmEmailOtp.expirationDate":confirmEmailOtpUpdate.expirationDate,
                }
            }
        });

        emailEvent.emit("confirmEmail",{
            to: email,
            otp
        });

        return res.status(201).json({message:"Re-sent OTP Email"});

    };


}

export default new AuthenticationService;