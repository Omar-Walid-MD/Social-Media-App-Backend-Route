import type { Request, Response } from "express";
import { HUserDocument, IUser, ProviderEnum, RoleEnum, UserModel } from "../../db/models/User.model";
import { UserRepository } from "../../db/repository/user.repository";
import { IDeleteAccountInputsDTO, IFreezeAccountInputsDTO, ILogoutBodyInputsDTO, IRestoreAccountInputsDTO, ISendUpdateCodeBodyInputsDTO, ISendUpdateEmailBodyInputsDTO, IUpdateEmailBodyInputsDTO, IUpdateInfoBodyInputsDTO, IUpdatePasswordBodyInputsDTO, IVerifyUpdateCodeBodyInputsDTO } from "./user.dto";
import { createLoginCredentials, createRevokeToken, LogoutEnum } from "../../utils/security/token.security";
import { Schema, Types, UpdateQuery } from "mongoose";
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
import { CommentRepository, FriendRequestRepository, PostRepository } from "../../db/repository";
import { PostModel } from "../../db/models/Post.model";
import { FriendRequestModel } from "../../db/models/FriendRequest.model";
import { CommentModel } from "../../db/models/Comment.model";

class UserService
{
    private userModel = new UserRepository(UserModel);
    private postModel = new PostRepository(PostModel);
    private friendRequestModel = new FriendRequestRepository(FriendRequestModel);
    private commentModel = new CommentRepository(CommentModel);

    constructor() {}

    profile = async(req: Request, res: Response): Promise<Response> => {

        const profile = await this.userModel.findById(
        {
            id: req.user?._id as Types.ObjectId,
            options: {
                populate: [{
                    path: "friends",
                    select: "firstName lastName email gender profilePicture"
                }]
            }
        });

        if(!profile) throw new NotFoundException("Failed to find user profile");

        return successResponse({
            res,
            statusCode: 201,
            data: {profile}
        });
        
    }

    dashboard = async(req: Request, res: Response): Promise<Response> => {

        const result = await Promise.allSettled([
            this.userModel.find({filter:{}}),
            this.postModel.find({filter:{}})
        ])

        return successResponse({
            res,
            statusCode: 201,
            data: { users: result[0], posts: result[1] }
        });
        
    }

    changeRole = async(req: Request, res: Response): Promise<Response> => {

        const {userId} = req.params as unknown as {userId:Types.ObjectId};
        const {role} = req.body as unknown as {role:RoleEnum};

        if(userId === req.user?._id) throw new BadRequestException("Cannot change own role");

        // can't change role of user with same role or super admin user
        let denyRoles: RoleEnum[] = [role, RoleEnum.superAdmin];

        // if logged in user is admin, cannot change role of another admin
        if(req.user?.role === RoleEnum.admin)
        {
            denyRoles.push(RoleEnum.admin)
        }

        const user = await this.userModel.findOneAndUpdate({
            filter: {
                _id: userId,
                role: {$nin: denyRoles}
            },
            update: {
                role
            }
        });

        if(!user) throw new NotFoundException("User not found");

        return successResponse({
            res,
            statusCode: 201
        });
        
    }

    sendFriendRequest = async(req: Request, res: Response): Promise<Response> => {

        const {userId} = req.params as unknown as {userId:Types.ObjectId};

        if(userId as unknown as string === req.user?._id.toString()) throw new BadRequestException("Cannot send friend request to self");

        if(userId)
        {
            const blocked = req.user?.blocked?.map((id)=>id.toString()) || [];
            if(blocked?.includes(userId as unknown as string))
            {
                throw new ConflictException("User is blocked");
            }
        }

        const checkFriendRequestExists = await this.friendRequestModel.findOne({
            filter: {
                createdBy: {$in: [req.user?._id,userId]},
                sendTo: {$in: [req.user?._id,userId]},
                acceptedAt: {$exists: false}
            }
        });

        if(checkFriendRequestExists) throw new ConflictException("Friend Request already exists between users");
        
        const user = await this.userModel.findOne({
            filter: {
                _id: userId,
                blocked: {$nin: req.user?._id}
            }
        });

        if(!user) throw new NotFoundException("Invalid recipient");
        

        const [friendRequest] = await this.friendRequestModel.create({
            data: [{
                createdBy: req.user?._id as Types.ObjectId,
                sentTo: userId,
            }]
        }) || [];

        if(!friendRequest) throw new BadRequestException("Something went wrong");

        return successResponse({res,statusCode:201});
    }

    acceptFriendRequest = async(req: Request, res: Response): Promise<Response> => {

        const {requestId} = req.params as unknown as {requestId: Types.ObjectId};

        const friendRequest = await this.friendRequestModel.findOneAndUpdate({
            filter: {
                _id: requestId,
                sentTo: req.user?._id,
                acceptedAt: {$exists:false}
            },
            update: {
                acceptedAt: new Date()
            }
        });

        if(!friendRequest) throw new NotFoundException("Failed to fetch matching request");

        await Promise.all([
            await this.userModel.updateOne({filter:{_id:friendRequest.createdBy},update:{$addToSet:{friends:friendRequest.sentTo}}}),
            await this.userModel.updateOne({filter:{_id:friendRequest.sentTo},update:{$addToSet:{friends:friendRequest.createdBy}}})
        ]);
        
        return successResponse({res,statusCode:201});
    }

    deleteFriendRequest = async(req: Request, res: Response): Promise<Response> => {

        const {requestId} = req.params as unknown as {requestId: Types.ObjectId};

        const friendRequest = await this.friendRequestModel.deleteOne({
            filter: {
                _id: requestId,
                $or: [
                    {sentTo: req.user?._id},
                    {createdBy: req.user?._id}
                ],
                acceptedAt: {$exists:false}
            }
        });

        if(!friendRequest?.deletedCount) throw new NotFoundException("Failed to delete friend request");

        return successResponse({res});
    }

    unfriendUser = async(req: Request, res: Response): Promise<Response> => {

        const {userId} = req.params as unknown as {userId:Types.ObjectId};

        if(userId)
        {
            const friends = req.user?.friends?.map((id)=>id.toString()) || [];
            if(!friends?.includes(userId as unknown as string))
            {
                throw new NotFoundException("User is invalid or not a friend");
            }
        }

        const user = await this.userModel.findOne({
            filter: {_id: userId}
        });

        if(!user) throw new NotFoundException("User is invalid or not a friend");

        await Promise.allSettled([
            this.userModel.updateOne({
                filter: {_id: req.user?._id},
                update: {
                    $pull:{friends:userId}
                }
            }),
            this.userModel.updateOne({
                filter: {_id: userId},
                update: {
                    $pull:{friends:req.user?._id}
                }
            })
        ]);

        return successResponse({res,statusCode:201});
    }

    blockUser = async(req: Request, res: Response): Promise<Response> => {

        const {userId} = req.params as unknown as {userId:Types.ObjectId};

        if(userId)
        {
            const blocked = req.user?.blocked?.map((id)=>id.toString()) || [];
            if(blocked?.includes(userId as unknown as string))
            {
                throw new ConflictException("User already blocked");
            }
        }

        const user = await this.userModel.findOne({
            filter: {_id: userId}
        });

        if(!user) throw new NotFoundException("Invalid user");

        const wasFriend = req.user?.friends?.includes(new Schema.Types.ObjectId(userId as unknown as string));

        if(wasFriend)
        {
            await Promise.allSettled([
                this.userModel.updateOne({
                    filter: {_id: req.user?._id},
                    update: {
                        $addToSet:{blocked:userId},
                        $pull:{friends:userId}
                    }
                }),
                this.userModel.updateOne({
                    filter: {_id: userId},
                    update: {
                        $pull:{friends:req.user?._id}
                    }
                })
            ]);
        }
        else
        {
            await this.userModel.updateOne({
                filter: {_id: req.user?._id},
                update: {
                    $addToSet:{blocked:userId}
                }
            });
        }

        return successResponse({res,statusCode:201});
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

        await this.postModel.deleteMany({
            filter: {createdBy: userId}
        });

        await this.commentModel.deleteMany({
            filter: {createdBy: userId}
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