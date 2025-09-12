import {z} from "zod";
import { AllowCommentsEnum, AvailabilityEnum, LikeActionNum } from "../../db/models/Post.model";
import { generalFields } from "../../middleware/validation.middleware";
import { fileValidation } from "../../utils/multer/cloud.multer";

export const createPost = {
    body: z.strictObject({
        content: z.string().min(2).max(500000).optional(),
        attachments: z.array(generalFields.file(fileValidation.image)).max(2).optional(),
        allowComments: z.enum(AllowCommentsEnum).default(AllowCommentsEnum.allow),
        availability: z.enum(AvailabilityEnum).default(AvailabilityEnum.public),

        tags: z.array(generalFields.id).max(10).optional(),
    }).superRefine((data,ctx)=>{

        if(!data.attachments?.length && !data.content)
        {
            ctx.addIssue({
                code: "custom",
                path: ["content"],
                message: "Missing Post content or attachments"
            });
        }

        if(data.tags?.length && data.tags.length !== [...new Set(data.tags)].length)
        {
            ctx.addIssue({
                code: "custom",
                path: ["tags"],
                message: "Duplicated tagged users"
            });
        }
    })
}

export const likePost = {
    params: z.strictObject({
        postId: generalFields.id
    }),
    query: z.strictObject({
        action: z.enum(LikeActionNum).default(LikeActionNum.like)
    })
}