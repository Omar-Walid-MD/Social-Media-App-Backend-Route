import {z} from "zod";
import { deleteComment, freezeComment, getComment, restoreComment } from "./comment.validation";

export type IGetCommentInputsDTO = z.infer<typeof getComment.params>;

export type IFreezeCommentInputsDTO = z.infer<typeof freezeComment.params>;
export type IRestoreCommentInputsDTO = z.infer<typeof restoreComment.params>;
export type IDeleteCommentInputsDTO = z.infer<typeof deleteComment.params>;
