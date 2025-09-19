import {z} from "zod";
import { deletePost, freezePost, getPost, likePost, restorePost } from "./post.validation";

export type ILikePostQueryInputsDTO = z.infer<typeof likePost.query>;

export type IGetPostInputsDTO = z.infer<typeof getPost.params>;
export type IFreezePostInputsDTO = z.infer<typeof freezePost.params>;
export type IRestorePostInputsDTO = z.infer<typeof restorePost.params>;
export type IDeletePostInputsDTO = z.infer<typeof deletePost.params>;
