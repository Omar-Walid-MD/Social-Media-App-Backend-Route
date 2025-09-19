import { DatabaseRepository } from "./db.repository";
import {IFriendRequest as TDocument} from "../models/FriendRequest.model";
import { Model } from "mongoose";

export class FriendRequestRepository extends DatabaseRepository<TDocument> {
        
    constructor(protected override readonly model: Model<TDocument>)
    {
        super(model);
    }

    
}