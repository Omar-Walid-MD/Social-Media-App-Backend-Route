import { Request, Response } from "express";
import { successResponse } from "../../utils/response/success.response";
import { PostRepository } from "../../db/repository/post.repository";
import { AvailabilityEnum, HPostDocument, LikeActionNum, PostModel } from "../../db/models/Post.model";
import { UserRepository } from "../../db/repository/user.repository";
import { UserModel } from "../../db/models/User.model";
import { deleteFiles, uploadFiles } from "../../utils/multer/s3.config";
import {v4 as uuid} from "uuid";
import { BadRequestException, NotFoundException } from "../../utils/response/error.response";
import { IDeletePostInputsDTO, IFreezePostInputsDTO, IGetPostInputsDTO, ILikePostQueryInputsDTO, IRestorePostInputsDTO } from "./post.dto";
import { Types, UpdateQuery } from "mongoose";

export const postAvailability = (req: Request) =>
{
    return [
        {availability:AvailabilityEnum.public},
        {
            availability:AvailabilityEnum.onlyMe,
            createdBy: req.user?._id
        },
        {
            availability:AvailabilityEnum.friends,
            createdBy: {$in: [...(req.user?.friends || []), req.user?._id]}
        },
        {
            availability:{$ne: AvailabilityEnum.onlyMe},
            tags: {$in: req.user?._id}
        }
    ]
}

class PostService
{
    private postModel = new PostRepository(PostModel);
    private userModel = new UserRepository(UserModel);

    constructor(){}

    createPost = async(req: Request, res: Response): Promise<Response> => {
        
        if(req.body.tags?.length)
        {
            const taggedUsers = await this.userModel.find({
                filter: {_id: {$in: req.body.tags, $ne: req.user?._id}}
            });

            if(taggedUsers.length !== req.body.tags.length)
            {
                throw new NotFoundException("Some of the mentioned users do not exist");
            }
        }

        let attachments: string[] = [];
        let assetsFolderId: string = uuid();
        if(req.files?.length)
        {
            attachments = await uploadFiles({
                files: req.files as Express.Multer.File[],
                path: `/users/${req.user?._id}/${assetsFolderId}`
            })
        }

        const post = await this.postModel.create({
            data: {
                ...req.body,
                attachments,
                assetsFolderId,
                createdBy: req.user?._id
            }
        });

        if(!post)
        {
            if(attachments?.length)
            {
                await deleteFiles({urls: attachments})
            }
            throw new BadRequestException("Fail to create this post");
        }
            
        return successResponse({res,statusCode:201,data:{post}});
    }

    getPost = async(req: Request, res:Response): Promise<Response> => {

        const {postId} = req.params as IGetPostInputsDTO;

        const post = await this.postModel.findOne({
            filter: {
                _id: postId,
                $or: postAvailability(req)
            }
        });

        if(!post)
        {
            throw new NotFoundException("Post not found");
        }

        return successResponse({res,data:{post}});
    }

    likePost = async(req: Request, res: Response): Promise<Response> => {

        const {postId} = req.params as {postId: string};

        const {action} = req.query as ILikePostQueryInputsDTO;

        let update: UpdateQuery<HPostDocument> = {$addToSet: {likes: req.user?._id}};

        if(action === LikeActionNum.unlike)
        {
            update = {$pull: {likes: req.user?._id}};
        }

        const post = await this.postModel.findOneAndUpdate({
            filter: {
                _id: postId,
                $or: postAvailability(req) 
            },
            update
        });

        if(!post) throw new NotFoundException("Post does not exist");

        return successResponse({res});
    }

    updatePost = async(req: Request, res: Response): Promise<Response> => {
        
        const {postId} = req.params as unknown as {postId:Types.ObjectId};

        const post = await this.postModel.findOne({
            filter: {
                _id: postId,
                createdBy: req.user?._id,
            }
        });

        if(!post)
        {
            throw new NotFoundException("Failed to find matching result");
        }

        
        if(req.body.tags?.length)
        {
            const taggedUsers = await this.userModel.find({
                filter: {_id: {$in: req.body.tags, $ne: req.user?._id}}
            });

            if(taggedUsers.length !== req.body.tags.length)
            {
                throw new NotFoundException("Some of the mentioned users do not exist");
            }
        }

        let attachments: string[] = [];
        if(req.files?.length)
        {
            attachments = await uploadFiles({
                files: req.files as Express.Multer.File[],
                path: `/users/${post.createdBy}/${post.assetsFolderId}`
            })
        }

        const updatedPost = await this.postModel.updateOne({
            filter: {
                _id: post._id
            },
            update: [
                {
                    $set: {
                        content: req.body.content,
                        allowComments: req.body.allowComments || post.allowComments,
                        availability: req.body.availability || post.availability,
                        attachments: {
                            $setUnion: [
                                {
                                    $setDifference: ["$attachments",req.body.removedAttachments || []]
                                },
                                attachments
                            ],
                        },
                        tags: {
                            $setUnion: [
                                {
                                    $setDifference: ["$tags",(req.body.removedTags || []).map((tag: string) => Types.ObjectId.createFromHexString(tag))]
                                },
                                (req.body.tags || []).map((tag: string) => Types.ObjectId.createFromHexString(tag))
                            ],
                        }
                    }
                }
            ]
        });
        


        if(!updatedPost.matchedCount)
        {
            if(attachments?.length)
            {
                await deleteFiles({urls: attachments})
            }
            throw new BadRequestException("Fail to create this post");
        }
        else if(req.body.removedAttachments?.length)
        {
            await deleteFiles({urls: req.body.removedAttachments})
        }
        
            
        return successResponse({res,statusCode:201,data:{post}});
    }

    postList = async(req: Request, res: Response): Promise<Response> => {
    
        const posts = await this.postModel.paginate({
            filter: {$or: postAvailability(req)},
            options: {
                populate: [{
                    path: "comments",
                    match: {
                        commentId: {$exists:false},
                        freezedAt: {$exists:false}
                    },
                    populate: [{
                        path: "replies",
                        match: {
                            commentId: {$exists:true},
                            freezedAt: {$exists:false}
                        },
                        populate: [{
                            path: "replies",
                            match: {
                                commentId: {$exists:true},
                                freezedAt: {$exists:false}
                            }
                        }]
                    }]
                }]
            }
        });

        return successResponse({res,data:{posts}});
    }

    freezePost = async(req: Request, res:Response): Promise<Response> => {

        const {postId} = req.params as IFreezePostInputsDTO;

        if(!postId)
        {
            throw new BadRequestException("Missing Post ID");
        }

        const post = await this.postModel.updateOne({
            filter: {
                _id: postId,
                freezedAt: {$exists: false}
            },
            update: {
                freezedAt: new Date(),
                freezedBy: req.user?._id,
                $unset: {
                    restoredAt: 1,
                    restoredBy: 1
                }
            }
        });

        if(!post.matchedCount) throw new NotFoundException("Post not found or failed to freeze this post");

        return successResponse({res});
    }

    restorePost = async(req: Request, res:Response): Promise<Response> => {

        const {postId} = req.params as IRestorePostInputsDTO;

        // add condition for freezedBy
        const post = await this.postModel.updateOne({
            filter: {
                _id: postId,
                freezedAt: {$exists: true},
                paranoid: false
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

        if(!post.matchedCount) throw new NotFoundException("Post not found or failed to restore this post");

        return successResponse({res});
    }

    deletePost = async(req: Request, res:Response): Promise<Response> => {

        const {postId} = req.params as IDeletePostInputsDTO;

        const post = await this.postModel.findOneAndDelete({
            filter: {
                _id: postId,
            }
        });

        if(!post) throw new NotFoundException("Post not found or failed to delete this post");

        return successResponse({res});
    }
    

}

export const postService = new PostService();