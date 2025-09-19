import {z} from "zod";
import { generalFields } from "../../middleware/validation.middleware";
import { fileValidation } from "../../utils/multer/cloud.multer";
import { Types } from "mongoose";

export const createComment = {
    params: z.strictObject({
        postId: generalFields.id
    }),
    body: z.strictObject({
        content: z.string().min(2).max(500000).optional(),
        attachments: z.array(generalFields.file(fileValidation.image)).max(2).optional(),
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

export const replyToComment = {
    params: createComment.params.extend({
        commentId: generalFields.id
    }),
    body: createComment.body
    
}

export const updateComment = {
    params: replyToComment.params,
    body: z.strictObject({
        content: z.string().min(2).max(500000).optional(),

        attachments: z.array(generalFields.file(fileValidation.image)).max(2).optional(),
        removedAttachments: z.array(z.string()).max(2).optional(),

        tags: z.array(generalFields.id).max(10).optional(),
        removedTags: z.array(generalFields.id).max(10).optional(),

    }).superRefine((data,ctx)=>{

        if(!Object.values(data)?.length)
        {
            ctx.addIssue({
                code: "custom",
                message: "All fields are empty"
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

        if(data.removedTags?.length && data.removedTags.length !== [...new Set(data.removedTags)].length)
        {
            ctx.addIssue({
                code: "custom",
                path: ["removedTags"],
                message: "Duplicated removed tags"
            });
        }
    })
}


export const freezeComment = {
    params: z.object({
        commentId: z.string()
    }).refine(data=>{

        return Types.ObjectId.isValid(data?.commentId || "");

    },{error:"Invalid ObjectId format",path:["commentId"]})
}

export const restoreComment = {
    params: z.object({
        commentId: z.string()
    }).refine(data=>{

        return Types.ObjectId.isValid(data.commentId);

    },{error:"Invalid ObjectId format",path:["commentId"]})
}

export const deleteComment = restoreComment;
export const getComment = restoreComment;