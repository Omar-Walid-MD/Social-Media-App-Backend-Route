import { HydratedDocument, model, models, Schema, Types } from "mongoose";


export interface IFriendRequest {
    createdBy: Types.ObjectId;
    sentTo: Types.ObjectId;
    acceptedAt?: Date;
}


export type HFriendRequestDocument = HydratedDocument<IFriendRequest>;


const friendRequestSchema = new Schema<IFriendRequest>({
    createdBy: {type: Schema.Types.ObjectId, ref: "User", required: true},
    sentTo: {type: Schema.Types.ObjectId, ref: "User", required: true},
    acceptedAt: Date

},{
    timestamps: true,
    strictQuery: true,
    toObject: {virtuals:true},
    toJSON: {virtuals:true}
});


export const FriendRequestModel = models.friendRequest || model<IFriendRequest>("FriendRequest",friendRequestSchema);