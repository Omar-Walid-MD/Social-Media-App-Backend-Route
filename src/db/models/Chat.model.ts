import { model } from "mongoose";
import { models } from "mongoose";
import { Schema, Types, HydratedDocument } from "mongoose";

export interface IMessage
{
    content: string;
    createdBy: Types.ObjectId;
    creatadAt?: Date;
    updatedAt?: Date;
}

export type HMessageDocument = HydratedDocument<IMessage>;

export interface IChat
{
    participants: Types.ObjectId[];
    createdBy: Types.ObjectId;
    messages: IMessage[];

    group?: string;
    groupImage?: string;
    roomId?: string;

    creatadAt?: Date;
    updatedAt?: Date;
}

export type HChatDocument = HydratedDocument<IChat>;

const messageSchema = new Schema<IMessage>(
{
    content: {type: String, minlength:2, maxlength:500000, required: true},
    createdBy: {type: Schema.Types.ObjectId, ref: "User", required: true},
},
{
    timestamps: true
} 
)

const chatSchema = new Schema<IChat>(
{
    participants: [{type: Schema.Types.ObjectId, ref: "User", required: true}],
    createdBy: {type: Schema.Types.ObjectId, ref: "User", required: true},
    group: {type: String},
    groupImage: {type: String},
    roomId: {type: String, required: function(){return this.roomId}},
    messages: [messageSchema]
},
{
    timestamps: true
});

export const ChatModel = models.Chat || model("Chat",chatSchema);