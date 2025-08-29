import type { Request, Response } from "express";
import { ProviderEnum, UserModel } from "../../db/models/User.model";
import { ApplicationException, BadRequestException, ConflictException, NotFoundException } from "../../utils/response/error.response";
import { compareHash, generateHash } from "../../utils/security/hash.security";
import { emailEvent } from "../../utils/event/email.events";
import { createLoginCredentials } from "../../utils/security/token.security";
import { IConfirmEmailBodyInputsDTO, IForgotCodeBodyInputsDTO, IGmail, ILoginBodyInputsDTO, IResetForgotCodeBodyInputsDTO, ISignUpBodyInputsDTO, IVerifyForgotCodeBodyInputsDTO } from "./auth.dto";
import { UserRepository } from "../../db/repository/user.repository";
import { generateNumberOtp } from "../../utils/otp";
import {OAuth2Client, TokenPayload} from "google-auth-library";

class AuthenticationService
{
    private userModel = new UserRepository(UserModel);

    constructor() {}

    signup = async (req: Request,res: Response): Promise<Response> =>
    {
        const {username,email,password}: ISignUpBodyInputsDTO = req.body;

        const checkUserExist = await this.userModel.findOne({
            filter: {email},
            select: "email",
            options: {
                lean: true
            }
        });

        if(checkUserExist)
        {
            throw new ConflictException("User already exists");
        }

        const otp = generateNumberOtp();

        const user = await this.userModel.createUser({
            data: [{
                username,
                email,
                password: await generateHash(password),
                confirmEmailOtp: await generateHash(String(otp))
            }]
        });

        emailEvent.emit("confirmEmail",{
            to: email,
            otp
        })

        return res.status(201).json({message: "Done",data: {user}});
    };

    login = async (req: Request,res: Response): Promise<Response> =>
    {
        const { email, password}: ILoginBodyInputsDTO = req.body;
    
        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: ProviderEnum.system
            }
        });

        if(!user)
        {
            throw new NotFoundException("Invalid Login data");
        }

        if(!user.confirmedAt)
        {
            throw new BadRequestException("Please verify your account first");
        }
        
        if(!await compareHash(password,user.password))
        {
            throw new NotFoundException("Invalid Login data");
        }

        const credentials = await createLoginCredentials(user);

        return res.json({message:"Done",data:{credentials}});
    };

    private async verifyGmailAccount(idToken: string): Promise<TokenPayload>
    {
        const client = new OAuth2Client();
        
        const ticket = await client.verifyIdToken({
            idToken,
            audience: (process.env.WEB_CLIENT_IDS as string).split(",") || [],  // Specify the WEB_CLIENT_ID of the app that accesses the backend
        });
        const payload = ticket.getPayload();

        if(!payload?.email_verified)
        {
            throw new BadRequestException("Failed to verify this google account");
        }

        return payload;
    }

    loginWithGmail = async (req: Request, res: Response): Promise<Response> => {

        const {idToken}: IGmail = req.body;
        const {email}: Partial<TokenPayload> = await this.verifyGmailAccount(idToken);

        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: ProviderEnum.google
            },
        });

        if(!user)
        {
            throw new NotFoundException("Not registered account or registered with another provider");
        }

        const credentials = await createLoginCredentials(user);

        return res.status(201).json({message:"Done",data:{credentials}})
    }

    signupWithGmail = async (req: Request, res: Response): Promise<Response> => {

        const {idToken}: IGmail = req.body;
        const {email, family_name, given_name, picture}: Partial<TokenPayload> = await this.verifyGmailAccount(idToken);

        const user = await this.userModel.findOne({
            filter: {email},
        });

        if(user)
        {
            if(user.provider === ProviderEnum.google)
            {
                return await this.loginWithGmail(req, res);
            }
            throw new ConflictException(`Email exists with another provider: ${user.provider}`);
        }

        const [newUser] = await this.userModel.create({
            data: [{
                email: email as string,
                firstName:given_name as string,
                lastName: family_name as string,
                profilePicture: picture as string,
                confirmedAt: new Date(),
                provider: ProviderEnum.google
            }]
        }) || [];

        if(!newUser) throw new BadRequestException("Faile to signup with Gmail. Please try again later.");

        const credentials = await createLoginCredentials(newUser);

        return res.status(201).json({message:"Done",data:{credentials}})
    }


    confirmEmail = async (req: Request, res: Response): Promise<Response> =>
    {
        const {email,otp}: IConfirmEmailBodyInputsDTO = req.body;

        const user = await this.userModel.findOne({
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


        if(!await compareHash(otp,user.confirmEmailOtp as string))
        {

            throw new ConflictException("Invalid confirmation code");
        }

        const updatedUser = await this.userModel.updateOne({
            filter: {email},
            update: {
                confirmedAt: new Date(),
                $unset: {confirmEmailOtp: true}
            }
        });

        if(!updatedUser) throw new ApplicationException("Fail to confirm user email");

        return res.status(201).json({message:"Done"});

    };


    resendConfirmEmail = async (req: Request,res: Response) => {

        const {email} = req.body;

        const user = await this.userModel.findOne({
            filter: {
                email,
                confirmedAt: {
                    $exists: false
                },
                confirmEmailOtp: {
                    $exists: true
                }
            }
        });

        if(!user) throw new NotFoundException("Invalid account or already verified");

        const otp = generateNumberOtp();

        await this.userModel.updateOne({
            filter: {email},
            update: {
                confirmEmailOtp: generateHash(String(otp))
            }
        });

        emailEvent.emit("confirmEmail",{
            to: email,
            otp
        });

        return res.status(201).json({message:"Re-sent OTP Email"});

    };

    sendForgotPasswordCode = async (req: Request,res: Response): Promise<Response> =>
    {
        const { email }: IForgotCodeBodyInputsDTO = req.body;
    
        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: ProviderEnum.system,
                confirmedAt: {$exists: true}
            }
        });

        if(!user)
        {
            throw new NotFoundException("Invalid account");
        }

        const otp = generateNumberOtp();

        const result = await this.userModel.updateOne({
            filter: {email},
            update: {
                resetPasswordOtp: await generateHash(String(otp))
            }
        });

        if(!result.matchedCount)
        {
            throw new BadRequestException("Failed to send reset code. Please try again later");
        }

        emailEvent.emit("sendResetPassword",{to:email,otp})

        return res.json({message:"Done"});
    };

    verifyForgotPasswordCode = async (req: Request,res: Response): Promise<Response> =>
    {
        const { email, otp }: IVerifyForgotCodeBodyInputsDTO = req.body;
    
        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: ProviderEnum.system,
                confirmedAt: {$exists: true},
                resetPasswordOtp: {$exists: true}
            }
        });

        if(!user)
        {
            throw new NotFoundException("Invalid account");
        }

        if(!await compareHash(otp, user.resetPasswordOtp as string))
        {
            throw new ConflictException("Invalid OTP");
        }



        return res.json({message:"Done"});
    };

    resetForgotPassword = async (req: Request,res: Response): Promise<Response> =>
    {
        const { email, otp, password }: IResetForgotCodeBodyInputsDTO = req.body;
    
        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: ProviderEnum.system,
                confirmedAt: {$exists: true},
                resetPasswordOtp: {$exists: true}
            }
        });

        if(!user)
        {
            throw new NotFoundException("Invalid account");
        }

        if(!await compareHash(otp, user.resetPasswordOtp as string))
        {
            throw new ConflictException("Invalid OTP");
        }

        const result = await this.userModel.updateOne({
            filter: {email},
            update: {
                $unset: {resetPasswordOtp: true},
                changeCredentialsTime: new Date(),
                password: await generateHash(password)
            }
        });

        if(!result.matchedCount)
        {
            throw new BadRequestException("Failed to reset password");
        }



        return res.json({message:"Done"});
    };


}

export default new AuthenticationService();