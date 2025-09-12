import { Router } from "express";
import { authentication } from "../../middleware/authentication.middleware";
import postService from "./post.service";
import { cloudFileUpload, fileValidation } from "../../utils/multer/cloud.multer";
import { validation } from "../../middleware/validation.middleware";
import * as validators from "./post.validation";

const router: Router = Router();

router.post("/",
    authentication(),
    cloudFileUpload({validation:fileValidation.image}).array("attachments",2),
    validation(validators.createPost),
    postService.createPost);

router.patch("/:postId/like",
    authentication(),
    validation(validators.likePost),
    postService.likePost
)

export default router;