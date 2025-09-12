import { HydratedDocument, model, models, Schema, Types } from "mongoose";
import { emailEvent } from "../../utils/event/email.events";
import { HUserDocument } from "./User.model";

export enum AllowCommentsEnum
{
    allow="allow",
    deny="deny"
}

export enum AvailabilityEnum
{
    public="public",
    friends="friends",
    onlyMe="only-me"
}

export enum LikeActionNum
{
    like="like",
    unlike="unlike"
}

export interface IPost {
    content?: string;
    attachments?: string[];
    assetsFolderId: string;
    
    allowComments: AllowCommentsEnum;
    availability: AvailabilityEnum;
    
    likes?: Types.ObjectId[];
    tags?: Types.ObjectId[];

    createdBy: Types.ObjectId;

    freezedBy?: Types.ObjectId;
    freezedAt?: Date;

    restoredBy?: Types.ObjectId;
    restoredAt?: Date;

    createdAt: Date;
    updatedAt?: Date;
}


export type HPostDocument = HydratedDocument<IPost>;


const postSchema = new Schema<IPost>({

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
    assetsFolderId: {
        type: String,
        required: true
    },
    
    allowComments: {type:String, enum:AllowCommentsEnum, default: AllowCommentsEnum.allow},
    availability: {type:String, enum:AvailabilityEnum, default: AvailabilityEnum.public},
    
    likes: [{type: Schema.Types.ObjectId, ref: "User"}],
    tags: [{type: Schema.Types.ObjectId, ref: "User"}],

    createdBy: {type: Schema.Types.ObjectId, ref: "User"},

    freezedBy: {type: Schema.Types.ObjectId, ref: "User"},
    freezedAt: Date,

    restoredBy: {type: Schema.Types.ObjectId, ref: "User"},
    restoredAt: Date,

},{
    timestamps: true,
    strictQuery: true
});

postSchema.pre(["findOneAndUpdate","updateOne"],function(next)
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


postSchema.post("save",async function(doc: HPostDocument, next)
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
                    post: populatedDoc,
                    user: taggedUser
                });
            }
        }
    }
    next();
});


export const PostModel = models.Post || model<IPost>("Post",postSchema);