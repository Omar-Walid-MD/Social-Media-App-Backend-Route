import { Router } from "express";
import { authentication } from "../../middleware/authentication.middleware";
import { validation } from "../../middleware/validation.middleware";
import * as validators from "./chat.validations"
import {ChatService} from "./chat.service";
import { cloudFileUpload, fileValidation } from "../../utils/multer/cloud.multer";

const chatService = new ChatService();

const router = Router({
    mergeParams: true
});

router.get("/",
    authentication(),
    validation(validators.getChat),
    chatService.getChat);

router.get("/group/:groupId",
    authentication(),
    validation(validators.getChattingGroup),
    chatService.getChattingGroup);

router.post("/group",
    authentication(),
    cloudFileUpload({validation:fileValidation.image}).single("attachment"),
    validation(validators.createChattingGroup),
    chatService.createChattingGroup);

export default router;