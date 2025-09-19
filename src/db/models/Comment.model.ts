import { HydratedDocument, model, models, Schema, Types } from "mongoose";
import { emailEvent } from "../../utils/event/email.events";
import { IPost } from "./Post.model";
import { CommentRepository } from "../repository";
import { deleteFiles } from "../../utils/multer/s3.config";


export interface IComment {
    createdBy: Types.ObjectId;
    postId: Types.ObjectId | Partial<IPost>;
    commentId?: Types.ObjectId;

    content?: string;
    attachments?: string[];
    
    likes?: Types.ObjectId[];
    tags?: Types.ObjectId[];

    except?: Types.ObjectId[];
    only?: Types.ObjectId[];

    freezedBy?: Types.ObjectId;
    freezedAt?: Date;

    restoredBy?: Types.ObjectId;
    restoredAt?: Date;

    createdAt: Date;
    updatedAt?: Date;
}


export type HCommentDocument = HydratedDocument<IComment>;


const commentSchema = new Schema<IComment>({

    content: {
        type: String,
        minlength: 2,
        maxlength: 500000,
        required: function(this)
        {
            return !this.attachments?.length;
        }
    },
    attachments: [String],
    
    likes: [{type: Schema.Types.ObjectId, ref: "User"}],
    tags: [{type: Schema.Types.ObjectId, ref: "User"}],

    createdBy: {type: Schema.Types.ObjectId, ref: "User", required: true},
    except: [{type: Schema.Types.ObjectId, ref: "User"}],
    only: [{type: Schema.Types.ObjectId, ref: "User"}],

    postId: {type: Schema.Types.ObjectId, ref: "Post", required: true},
    commentId: {type: Schema.Types.ObjectId, ref: "Comment"},

    freezedBy: {type: Schema.Types.ObjectId, ref: "User"},
    freezedAt: Date,

    restoredBy: {type: Schema.Types.ObjectId, ref: "User"},
    restoredAt: Date,

},{
    timestamps: true,
    strictQuery: true,
    toObject: {virtuals:true},
    toJSON: {virtuals:true}
});

commentSchema.virtual("replies",{
    localField: "_id",
    foreignField: "commentId",
    ref: "Comment",
    justOne: true
});

commentSchema.pre(["findOne","find","countDocuments"],function(next)
{
    const query = this.getQuery();
    if(query.paranoid === false)
    {
        this.setQuery({...query});
    }
    else
    {
        this.setQuery({...query,freezedAt: {$exists:false}});
    }

    next();
});

commentSchema.pre(["findOneAndUpdate","updateOne"],function(next)
{
    const query = this.getQuery();
    if(query.paranoid === false)
    {
        this.setQuery({...query});
    }
    else
    {
        this.setQuery({...query,freezedAt: {$exists:false}});
    }

    next();
});


commentSchema.post("save",async function(doc: HCommentDocument, next)
{
    if(doc.tags?.length)
    {
        const populatedDoc = await doc.populate([{path:"tags"}]);

        if(populatedDoc.tags?.length)
        {
            for(const taggedUser of populatedDoc.tags as any[])
            {
                emailEvent.emit("sendTagEmail",{
                    to: taggedUser.email,
                    Comment: populatedDoc,
                    user: taggedUser
                });
            }
        }
    }
    next();
});

commentSchema.post("findOneAndDelete",async function(doc: HCommentDocument, next)
{
    if(doc)
    {
        const commentModel = new CommentRepository(CommentModel);
    
        await commentModel.deleteMany({
            filter: {commentId: doc._id}
        });
    
        if(doc?.attachments?.length)
        {
            await deleteFiles({urls: doc.attachments});
        }
    }

    next();
});


export const CommentModel = models.Comment || model<IComment>("Comment",commentSchema);