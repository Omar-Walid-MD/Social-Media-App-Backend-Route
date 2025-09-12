import type { Request, Response } from "express";
import { ProviderEnum, UserModel } from "../../db/models/User.model";
import { ApplicationException, BadRequestException, ConflictException, NotFoundException } from "../../utils/response/error.response";
import { compareHash, generateHash } from "../../utils/security/hash.security";
import { emailEvent } from "../../utils/event/email.events";
import { createLoginCredentials } from "../../utils/security/token.security";
import { IConfirmEmailBodyInputsDTO, IForgotCodeBodyInputsDTO, IGmail, ILoginBodyInputsDTO, IResetForgotCodeBodyInputsDTO, ISignUpBodyInputsDTO, IVerifyForgotCodeBodyInputsDTO } from "./auth.dto";
import { generateNumberOtp } from "../../utils/otp";
import {OAuth2Client, TokenPayload} from "google-auth-library";
import { successResponse } from "../../utils/response/success.response";
import { ILoginResponse } from "./auth.entites";
import { UserRepository } from "../../db/repository";

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

        await this.userModel.createUser({
            data: [{
                username,
                email,
                password,
                confirmEmailOtp: `${otp}`
            }]
        });

        return successResponse({res,statusCode:201});
    };

    login = async (req: Request,res: Response): Promise<Response> =>
    {
        const { email, password}: ILoginBodyInputsDTO = req.body;
    
        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: ProviderEnum.system,
                freezedAt: {$exists: false}
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

        if(user.twoStepVerification)
        {
            const otp = generateNumberOtp();
            await this.userModel.updateOne({
                filter: {email},
                update: {
                    loginOtp: await generateHash(String(otp))
                }
            });
            emailEvent.emit("confirmEmail",{
                to: email,
                otp
            });
            return successResponse({res,message:"Done. Sent Login Email"});
        }
        else
        {
            const credentials = await createLoginCredentials(user);
            return successResponse<ILoginResponse>({res,data:{credentials}});
        }

    };

    confirmLogin = async (req: Request,res: Response): Promise<Response> =>
    {
        const { email, password, otp} = req.body;
    
        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: ProviderEnum.system,
                freezedAt: {$exists: false}
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

        if(user.twoStepVerification)
        {
            if(!await compareHash(otp,user.loginOtp || ""))
            {
                throw new NotFoundException("Invalid OTP");
            }

            await this.userModel.updateOne({
                filter: {email},
                update: {
                    $unset: {loginOtp: true},
                }
            });
        }

        const credentials = await createLoginCredentials(user);
        return successResponse<ILoginResponse>({res,data:{credentials}});

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

        return successResponse<ILoginResponse>({res,data:{credentials}});
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

        return successResponse<ILoginResponse>({res,statusCode:201,data:{credentials}});
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

        return successResponse({res});

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
                confirmEmailOtp: await generateHash(String(otp))
            }
        });

        emailEvent.emit("confirmEmail",{
            to: email,
            otp
        });

        return successResponse({res,statusCode:201});

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

        return successResponse({res});

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

        return successResponse({res});
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

        return successResponse({res});
    };

    sendEnableVerification = async (req: Request,res: Response): Promise<Response> =>
    {
        if(req.user?.twoStepVerification) throw new BadRequestException("2 Step Verification Already enabled");

        const otp = generateNumberOtp();

        const result = await this.userModel.updateOne({
            filter: {email: req.user?.email},
            update: {
                enableVerificationOtp: await generateHash(String(otp))
            }
        });

        if(!result.matchedCount)
        {
            throw new BadRequestException("Failed to send code. Please try again later");
        }

        emailEvent.emit("sendEnableVerification",{to:req.user?.email,otp})

        return successResponse({res});

    };

    enableVerification = async (req: Request,res: Response): Promise<Response> =>
    {
        const { otp } = req.body;

        if(req.user?.twoStepVerification) throw new NotFoundException("2 Step Verification Already enabled");

        if(!await compareHash(otp, req.user?.enableVerificationOtp as string))
        {
            throw new ConflictException("Invalid OTP");
        }

        await this.userModel.updateOne({
            filter: {_id: req.user?._id},
            update: {
                $unset: {enableVerificationOtp: true},
                twoStepVerification: true
            }
        });

        return successResponse({res});
    };


}

export default new AuthenticationService();