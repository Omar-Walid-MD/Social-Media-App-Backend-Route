import { DatabaseRepository } from "./db.repository";
import {IComment as TDocument} from "../models/Comment.model";
import { Model } from "mongoose";

export class CommentRepository extends DatabaseRepository<TDocument> {
    
    constructor(protected override readonly model: Model<TDocument>)
    {
        super(model);
    }
}