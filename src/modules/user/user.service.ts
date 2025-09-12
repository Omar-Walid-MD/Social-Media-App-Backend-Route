import type { Request, Response } from "express";
import { HUserDocument, IUser, ProviderEnum, RoleEnum, UserModel } from "../../db/models/User.model";
import { UserRepository } from "../../db/repository/user.repository";
import { IDeleteAccountInputsDTO, IFreezeAccountInputsDTO, ILogoutBodyInputsDTO, IRestoreAccountInputsDTO, ISendUpdateCodeBodyInputsDTO, ISendUpdateEmailBodyInputsDTO, IUpdateEmailBodyInputsDTO, IUpdateInfoBodyInputsDTO, IUpdatePasswordBodyInputsDTO, IVerifyUpdateCodeBodyInputsDTO } from "./user.dto";
import { createLoginCredentials, createRevokeToken, LogoutEnum } from "../../utils/security/token.security";
import { Types, UpdateQuery } from "mongoose";
import { JwtPayload } from "jsonwebtoken";
import { createPresignedUploadLink, deleteFiles, deleteFolderByPrefix, uploadFiles } from "../../utils/multer/s3.config";
import { StorageEnum } from "../../utils/multer/cloud.multer";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from "../../utils/response/error.response";
import { s3Event } from "../../utils/multer/s3.events";
import { successResponse } from "../../utils/response/success.response";
import { IProfileImageResponse, IUserResponse } from "./user.entities";
import { ILoginResponse } from "../auth/auth.entites";
import { generateNumberOtp } from "../../utils/otp";
import { compareHash, generateHash } from "../../utils/security/hash.security";
import { emailEvent } from "../../utils/event/email.events";

class UserService
{
    private userModel = new UserRepository(UserModel);

    constructor() {}

    profile = async(req: Request, res: Response): Promise<Response> => {

        if(!req.user) throw new UnauthorizedException("Missing user details");

        return successResponse<IUserResponse>({
            res,
            statusCode: 201,
            data: {user: req.user}
        });
        
    }

    profileImage = async(req: Request, res: Response): Promise<Response> => {

        const {ContentType, OriginalName}: {ContentType: string; OriginalName: string} = req.body;
        const {url, key} = await createPresignedUploadLink({
            ContentType,
            OriginalName,
            path: `users/${req.decoded?._id}`
        });

        const user = await this.userModel.findByIdAndUpdate({
            id: req.user?._id as Types.ObjectId,
            update: {
                profilePicture: key,
                tempProfilePicture: req.user?.profilePicture
            }
        });

        if(!user) throw new BadRequestException("Failed to update user profile picture");

        s3Event.emit("trackProfileImageUpload",{
            userId: req.user?._id,
            oldKey: req.user?.profilePicture,
            key,
            expiresIn: 30000
        });

        return successResponse<IProfileImageResponse>({ res, data: {url} });

    }

    profileCoverImages = async(req: Request, res: Response): Promise<Response> => {

        const urls = await uploadFiles({
            storageApproach: StorageEnum.disk,
            files: req.files as Express.Multer.File[],
            path: `users/${req.decoded?._id}/cover`
        });

        const user = await this.userModel.findByIdAndUpdate({
            id: req.user?._id as Types.ObjectId,
            update: {
                coverImages: urls
            }
        });

        if(!user) throw new BadRequestException("Failed to update cover images");

        if(req.user?.coverImages)
        {
            await deleteFiles({urls:req.user.coverImages});
        }

        return successResponse<IUserResponse>({res,data:{user}});
    }

    updateBasicInfo = async(req: Request, res: Response): Promise<Response> => {

        const {firstName, lastName, gender, phone} = req.body as IUpdateInfoBodyInputsDTO;

        const user = await this.userModel.findOneAndUpdate({
            filter: {_id: req.user?._id as Types.ObjectId},
            update: {
                firstName,
                lastName,
                gender,
                phone
            },
            options: {
                new: true
            }
        });

        if(!user) throw new NotFoundException("User not found");

        return successResponse({res,data:{user}});
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

        if(!req.user) throw new UnauthorizedException("Missing user details");

        return successResponse<IUserResponse>({
            res,
            statusCode,
            data: {user: req.user}
        })

    }

    refreshToken = async(req: Request, res: Response): Promise<Response> => {

        const credentials = await createLoginCredentials(req.user as HUserDocument);
        await createRevokeToken(req.decoded as JwtPayload);

        return successResponse<ILoginResponse>({
            res,
            statusCode: 201,
            data: {credentials}
        });
    }

    freezeAccount = async(req: Request, res:Response): Promise<Response> => {

        const {userId} = (req.params as IFreezeAccountInputsDTO) || {};

        if(userId && req.user?.role !== RoleEnum.admin)
        {
            throw new ForbiddenException("Not authorized user");
        }

        const user = await this.userModel.updateOne({
            filter: {
                _id: userId || req.user?.id,
                freezedAt: {$exists: false}
            },
            update: {
                freezedAt: new Date(),
                freezedBy: req.user?._id,
                changeCredentialsTime: new Date(),
                $unset: {
                    restoredAt: 1,
                    restoredBy: 1
                }
            }
        });

        if(!user.matchedCount) throw new NotFoundException("User not found or failed to freeze this user");

        return successResponse({res});
    }

    restoreAccount = async(req: Request, res:Response): Promise<Response> => {

        const {userId} = req.params as IRestoreAccountInputsDTO;

        const user = await this.userModel.updateOne({
            filter: {
                _id: userId,
                freezedBy: {$ne: userId},
                freezedAt: {$exists: true}
            },
            update: {
                restoredAt: new Date(),
                restoredBy: req.user?._id,
                $unset: {
                    freezedAt: 1,
                    freezedBy: 1
                }
            }
        });

        if(!user.matchedCount) throw new NotFoundException("User not found or failed to restore this user");

        return successResponse({res});
    }

    deleteAccount = async(req: Request, res:Response): Promise<Response> => {

        const {userId} = req.params as IDeleteAccountInputsDTO;

        const user = await this.userModel.deleteOne({
            filter: {
                _id: userId,
                freezedAt: {$exists: true}
            }
        });

        if(!user.deletedCount) throw new NotFoundException("User not found or failed to delete this user");

        await deleteFolderByPrefix({
            path: `users/${userId}`
        });

        return successResponse({res});
    }


    sendUpdatePasswordCode = async (req: Request,res: Response): Promise<Response> =>
    {
        const { email, password } = req.body as ISendUpdateCodeBodyInputsDTO;
    
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

        if(!await compareHash(password, user.password as string))
        {
            throw new ConflictException("Incorrect password");
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

    verifyUpdatePasswordCode = async (req: Request,res: Response): Promise<Response> =>
    {
        const { email, otp } = req.body as IVerifyUpdateCodeBodyInputsDTO;
    
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

    updatePassword = async (req: Request,res: Response): Promise<Response> =>
    {
        const { email, otp, password, oldPassword }: IUpdatePasswordBodyInputsDTO = req.body;
    
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

        if(!await compareHash(oldPassword, user.password as string))
        {
            throw new ConflictException("Incorrect old password");
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
            throw new BadRequestException("Failed to update password");
        }

        return successResponse({res});
    };
    

    sendUpdateEmail = async (req: Request,res: Response): Promise<Response> =>
    {
        const { email, newEmail, password } = req.body as ISendUpdateEmailBodyInputsDTO;
    
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

        if(!await compareHash(password, user.password as string))
        {
            throw new ConflictException("Incorrect password");
        }

        if(await this.userModel.findOne({filter:{email:newEmail}}))
        {
            throw new ConflictException("Email already exists");
        }

        const otp = generateNumberOtp();

        const result = await this.userModel.updateOne({
            filter: {email},
            update: {
                updateEmailOtp: await generateHash(String(otp))
            }
        });

        if(!result.matchedCount)
        {
            throw new BadRequestException("Failed to send reset code. Please try again later");
        }

        emailEvent.emit("confirmEmail",{to:newEmail,otp})

        return successResponse({res});
    };


    updateEmail = async (req: Request,res: Response): Promise<Response> =>
    {
        const { email, newEmail, otp, password }: IUpdateEmailBodyInputsDTO = req.body;
    
        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: ProviderEnum.system,
                confirmedAt: {$exists: true},
                updateEmailOtp: {$exists: true}
            }
        });

        if(!user)
        {
            throw new NotFoundException("Invalid account");
        }

        if(!await compareHash(otp, user.updateEmailOtp as string))
        {
            throw new ConflictException("Invalid OTP");
        }

        if(!await compareHash(password, user.password as string))
        {
            throw new ConflictException("Incorrect password");
        }

        const result = await this.userModel.updateOne({
            filter: {email},
            update: {
                $unset: {updateEmailOtp: true},
                changeCredentialsTime: new Date(),
                email: newEmail
            }
        });

        if(!result.matchedCount)
        {
            throw new BadRequestException("Failed to update email");
        }

        return successResponse({res});
    };

}

export default new UserService();