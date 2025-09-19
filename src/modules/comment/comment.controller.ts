import { Router } from "express";
import { authentication, authorization } from "../../middleware/authentication.middleware";
import { cloudFileUpload, fileValidation } from "../../utils/multer/cloud.multer";
import commentService from "./comment.service";
import * as validators from "./comment.validation";
import { validation } from "../../middleware/validation.middleware";
import { endpoint } from "./comment.authorization";

const router = Router({mergeParams:true});

router.post("/",
    authentication(),
    cloudFileUpload({validation:fileValidation.image}).array("attachments",2),
    validation(validators.createComment),
    commentService.createComment
)

router.get("/:commentId",
    authentication(),
    validation(validators.getComment),
    commentService.getComment);

router.get("/:commentId/replies",
    authentication(),
    validation(validators.getComment),
    commentService.getCommentWithReplies);

router.post("/:commentId/reply",
    authentication(),
    cloudFileUpload({validation:fileValidation.image}).array("attachments",2),
    validation(validators.replyToComment),
    commentService.replyToComment
)

router.patch("/:commentId",
    authentication(),
    cloudFileUpload({validation:fileValidation.image}).array("attachments",2),
    validation(validators.updateComment),
    commentService.updateComment);

router.delete("/:commentId/freeze-comment",
    authentication(),
    validation(validators.freezeComment),
    commentService.freezeComment);

router.patch("/:commentId/restore-comment",
    authorization(endpoint.restoreComment),
    validation(validators.restoreComment),
    commentService.restoreComment);

router.delete("/:commentId",
    authentication(),
    validation(validators.deleteComment),
    commentService.deleteComment);


export default router;