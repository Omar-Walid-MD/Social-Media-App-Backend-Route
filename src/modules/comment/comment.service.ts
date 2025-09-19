import { Types } from "mongoose";
import { CommentModel } from "../../db/models/Comment.model";
import { AllowCommentsEnum, HPostDocument, PostModel } from "../../db/models/Post.model";
import { UserModel } from "../../db/models/User.model";
import { CommentRepository, PostRepository, UserRepository } from "../../db/repository";
import { BadRequestException, NotFoundException } from "../../utils/response/error.response";
import { successResponse } from "../../utils/response/success.response"
import type {Request, Response} from "express";
import { postAvailability } from "../post";
import { deleteFiles, uploadFiles } from "../../utils/multer/s3.config";
import { StorageEnum } from "../../utils/multer/cloud.multer";
import { IDeleteCommentInputsDTO, IFreezeCommentInputsDTO, IGetCommentInputsDTO, IRestoreCommentInputsDTO } from "./comment.dto";

class CommentService
{
    private userModel = new UserRepository(UserModel);
    private postModel = new PostRepository(PostModel);
    private commentModel = new CommentRepository(CommentModel);

    constructor() {}

    createComment = async(req: Request, res: Response): Promise<Response> => {
        
        const {postId} = req.params as unknown as {postId: Types.ObjectId};

        const post = await this.postModel.findOne({
            filter: {
                _id: postId,
                allowComments: AllowCommentsEnum.allow,
                $or: postAvailability(req)
            }
        });

        if(!post)
        {
            throw new NotFoundException("Failed to find matching post");
        }

        if(req.body?.tags?.length)
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
                path: `/users/${post.createdBy}/post/${post.assetsFolderId}`
            })
        }

        const comment = await this.commentModel.create({
            data: {
                ...req.body,
                attachments,
                postId,
                createdBy: req.user?._id
            }
        }); 

        if(!comment)
        {
            if(attachments?.length)
            {
                await deleteFiles({urls: attachments})
            }
            throw new BadRequestException("Fail to create this comment");
        }
            
        return successResponse({res,statusCode:201,data:{comment}});
    }

    replyToComment = async(req: Request, res: Response): Promise<Response> => {
        
        const {postId, commentId} = req.params as unknown as {postId: Types.ObjectId; commentId: Types.ObjectId;};

        const comment = await this.commentModel.findOne({
            filter: {
                _id: commentId,
                postId
            },
            options: {
                populate: [{
                    path:"postId",
                    match: {
                        allowComments: AllowCommentsEnum.allow,
                        $or: postAvailability(req)
                    }
                }]
            }
        });

        if(!comment?.postId)
        {
            throw new NotFoundException("Failed to find matching comment");
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
            const post = comment.postId as Partial<HPostDocument>;
            attachments = await uploadFiles({
                storageApproach: StorageEnum.memory,
                files: req.files as Express.Multer.File[],
                path: `/users/${post.createdBy}/post/${post.assetsFolderId}`
            })
        }

        const reply = await this.commentModel.create({
            data: {
                ...req.body,
                attachments,
                postId,
                commentId,
                createdBy: req.user?._id
            }
        });

        if(!reply)
        {
            if(attachments?.length)
            {
                await deleteFiles({urls: attachments})
            }
            throw new BadRequestException("Fail to create this reply");
        }
            
        return successResponse({res,statusCode:201,data:{reply}});
    }
    
    getComment = async(req: Request, res:Response): Promise<Response> => {

        const {commentId} = req.params as IGetCommentInputsDTO;

        const comment = await this.commentModel.findOne({
            filter: {
                _id: commentId
            },
            options: {
                populate: [{
                    path: "postId",
                    match: {
                        $or: postAvailability(req)
                    }
                }]
            }
        });

        if(!comment)
        {
            throw new NotFoundException("Comment not found");
        }

        return successResponse({res,data:{comment}});
    }

    getCommentWithReplies = async(req: Request, res:Response): Promise<Response> => {

        const {commentId} = req.params as IGetCommentInputsDTO;

        const comment = await this.commentModel.findOne({
            filter: {
                _id: commentId
            },
            options: {
                populate: [
                    {
                        path: "postId",
                        match: {
                            $or: postAvailability(req)
                        }
                    },
                    {
                        path: "replies"
                    }
                ]
            }
        });

        if(!comment)
        {
            throw new NotFoundException("Comment not found");
        }

        return successResponse({res,data:{comment}});
    }
    
    updateComment = async(req: Request, res: Response): Promise<Response> => {
            
        const {commentId} = req.params as unknown as {commentId:Types.ObjectId};

        const comment = await this.commentModel.findOne({
            filter: {
                _id: commentId,
                createdBy: req.user?._id,
            },
             options: {
                populate: [{
                    path:"postId",
                    match: {
                        allowComments: AllowCommentsEnum.allow,
                        $or: postAvailability(req)
                    }
                }]
            }
        });

        if(!comment?.postId)
        {
            throw new NotFoundException("Failed to find matching comment");
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
            const post = comment.postId as Partial<HPostDocument>;
            attachments = await uploadFiles({
                files: req.files as Express.Multer.File[],
                path: `/users/${post.createdBy}/${post.assetsFolderId}`
            })
        }

        const updatedComment = await this.commentModel.updateOne({
            filter: {
                _id: comment._id
            },
            update: [
                {
                    $set: {
                        content: req.body.content,
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
        


        if(!updatedComment.matchedCount)
        {
            if(attachments?.length)
            {
                await deleteFiles({urls: attachments})
            }
            throw new BadRequestException("Fail to create this comment");
        }
        else
        {
            if(req.body.removedAttachments?.length)
            {
                await deleteFiles({urls: req.body.removedAttachments})
            }
        }
            
        return successResponse({res,statusCode:201,data:{comment}});
    }

    freezeComment = async(req: Request, res:Response): Promise<Response> => {
    
        const {commentId} = req.params as IFreezeCommentInputsDTO;

        if(!commentId)
        {
            throw new BadRequestException("Missing Comment ID");
        }

        const comment = await this.commentModel.updateOne({
            filter: {
                _id: commentId,
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

        if(!comment.matchedCount) throw new NotFoundException("Comment not found or failed to freeze this comment");

        return successResponse({res});
    }

    restoreComment = async(req: Request, res:Response): Promise<Response> => {

        const {commentId} = req.params as IRestoreCommentInputsDTO;

        // add condition for freezedBy
        const comment = await this.commentModel.updateOne({
            filter: {
                _id: commentId,
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

        if(!comment.matchedCount) throw new NotFoundException("Comment not found or failed to restore this comment");

        return successResponse({res});
    }

    deleteComment = async(req: Request, res:Response): Promise<Response> => {

        const {commentId} = req.params as IDeleteCommentInputsDTO;

        const comment = await this.commentModel.findOneAndDelete({
            filter: {
                _id: commentId,
            }
        });

        if(!comment) throw new NotFoundException("Comment not found or failed to delete this comment");

        return successResponse({res});
    }
}

export default new CommentService();