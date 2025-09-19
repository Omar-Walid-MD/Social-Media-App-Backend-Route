import { DatabaseRepository, Lean } from "./db.repository";
import {IPost as TDocument} from "../models/Post.model";
import { HydratedDocument, Model, PopulateOptions, ProjectionType, QueryOptions, RootFilterQuery } from "mongoose";
import { CommentRepository } from "./comment.repository";
import { CommentModel } from "../models/Comment.model";

export class PostRepository extends DatabaseRepository<TDocument> {
    
    private commentModel = new CommentRepository(CommentModel);
    
    constructor(protected override readonly model: Model<TDocument>)
    {
        super(model);
    }

    async findCursor({
        filter, select, options
    }: {
        filter: RootFilterQuery<TDocument>;
        select?: ProjectionType<TDocument> | undefined;
        options?: QueryOptions<TDocument> | undefined;
    }): Promise<Lean<TDocument>[] | HydratedDocument<TDocument>[] | []>
    {
        const cursor = this.model
        .find(filter || {})
        .select(select || "")
        .populate(options?.populate as PopulateOptions[])
        .cursor();

        let result = [] as any[];

        for (let doc = await cursor.next(); doc !== null; doc = await cursor.next())
        {
            const comments = await this.commentModel.find({
                filter: {postId: doc._id, commentId: {$exists:false}}
            });
            result.push({post:doc,comments});
        }

        return result;
    }
}