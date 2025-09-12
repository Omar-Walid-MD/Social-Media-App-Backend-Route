import { Request, Response } from "express";
import { successResponse } from "../../utils/response/success.response";
import { PostRepository } from "../../db/repository/post.repository";
import { HPostDocument, LikeActionNum, PostModel } from "../../db/models/Post.model";
import { UserRepository } from "../../db/repository/user.repository";
import { UserModel } from "../../db/models/User.model";
import { deleteFiles, uploadFiles } from "../../utils/multer/s3.config";
import {v4 as uuid} from "uuid";
import { BadRequestException, NotFoundException } from "../../utils/response/error.response";
import { ILikePostQueryInputsDTO } from "./post.dto";
import { UpdateQuery } from "mongoose";


class PostService
{
    private postModel = new PostRepository(PostModel);
    private userModel = new UserRepository(UserModel);

    constructor(){}

    createPost = async(req: Request, res: Response): Promise<Response> => {
        
        if(req.body.tags?.length)
        {
            const taggedUsers = await this.userModel.find({
                filter: {_id: {$in: req.body.tags}}
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
            if(attachments.length)
            {
                await deleteFiles({urls: attachments})
            }
            throw new BadRequestException("Fail to create this post");
        }
            
        return successResponse({res,statusCode:201,data:{post}});
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
            filter: {_id: postId},
            update
        });

        if(!post) throw new NotFoundException("Post does not exist");

        return successResponse({res});
    }
}

export default new PostService();