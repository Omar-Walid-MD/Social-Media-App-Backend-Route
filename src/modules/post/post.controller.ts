import { Router } from "express";
import { authentication, authorization } from "../../middleware/authentication.middleware";
import { postService } from "./post.service";
import { cloudFileUpload, fileValidation } from "../../utils/multer/cloud.multer";
import { validation } from "../../middleware/validation.middleware";
import * as validators from "./post.validation";
import { commentRouter } from "../comment";
import { endpoint } from "./post.authorization";

const router: Router = Router();

router.use("/:postId/comment",commentRouter);

router.get("/",
    authentication(),
    postService.postList);

router.get("/:postId",
    authentication(),
    validation(validators.getPost),
    postService.getPost);

router.post("/",
    authentication(),
    cloudFileUpload({validation:fileValidation.image}).array("attachments",2),
    validation(validators.createPost),
    postService.createPost);

router.patch("/:postId/like",
    authentication(),
    validation(validators.likePost),
    postService.likePost);

router.patch("/:postId/",
    authentication(),
    cloudFileUpload({validation:fileValidation.image}).array("attachments",2),
    validation(validators.updatePost),
    postService.updatePost);

router.delete("/:postId/freeze-post",
    authentication(),
    validation(validators.freezePost),
    postService.freezePost);

router.patch("/:postId/restore-post",
    authorization(endpoint.restorePost),
    validation(validators.restorePost),
    postService.restorePost);

router.delete("/:postId",
    authentication(),
    validation(validators.deletePost),
    postService.deletePost);

export default router;