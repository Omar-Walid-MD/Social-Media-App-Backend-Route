import { DatabaseRepository } from "./db.repository";
import {IPost as TDocument} from "../models/Post.model";
import { Model } from "mongoose";

export class PostRepository extends DatabaseRepository<TDocument> {
    
    constructor(protected override readonly model: Model<TDocument>)
    {
        super(model);
    }
}