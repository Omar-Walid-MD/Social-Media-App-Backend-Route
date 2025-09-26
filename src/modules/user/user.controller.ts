import { Router } from "express";
import userService from "./user.service";
import * as validators from "./user.validation";
import { validation } from "../../middleware/validation.middleware";
import { authentication, authorization } from "../../middleware/authentication.middleware";
import { TokenEnum } from "../../utils/security/token.security";
import { cloudFileUpload, fileValidation, StorageEnum } from "../../utils/multer/cloud.multer";
import { endpoint } from "./user.authorization";
import { chatRouter } from "../chat";

const router: Router = Router();

router.use("/:userId/chat",chatRouter);

router.get("/",
    authentication(),
    userService.profile);

router.get("/dashboard",
    authorization(endpoint.dashboard),
    userService.dashboard
)

router.patch("/:userId/change-role",
    authorization(endpoint.changeRole),
    validation(validators.changeRole),
    userService.changeRole
)

router.post("/:userId/send-friend-request",
    authentication(),
    validation(validators.sendFriendRequest),
    userService.sendFriendRequest
)

router.patch("/accept-friend-request/:requestId",
    authentication(),
    validation(validators.acceptFriendRequest),
    userService.acceptFriendRequest
)

router.delete("/delete-friend-request/:requestId",
    authentication(),
    validation(validators.deleteFriendRequest),
    userService.deleteFriendRequest
)

router.patch("/:userId/unfriend",
    authentication(),
    validation(validators.unfriendUser),
    userService.unfriendUser
)

router.patch("/:userId/block",
    authentication(),
    validation(validators.blockUser),
    userService.blockUser
)

router.patch("/",
    authentication(),
    validation(validators.updateBasicInfo),
    userService.updateBasicInfo)

router.patch("/profile-image",
    authentication(),
    userService.profileImage);

router.patch("/profile-cover-images",
    authentication(),
    cloudFileUpload({
        validation: fileValidation.image,
        storageApproach:StorageEnum.disk
    }).array("images",2),
    userService.profileCoverImages);

router.post("/logout",
    authentication(),
    validation(validators.logout),
    userService.logout);

router.post("/refresh-token",
    authentication(TokenEnum.refresh),
    userService.refreshToken);

router.delete("{/:userId}/freeze-account",
    authentication(),
    validation(validators.freezeAccount),
    userService.freezeAccount);

router.patch("/:userId/restore-account",
    authorization(endpoint.restoreAccount),
    validation(validators.restoreAccount),
    userService.restoreAccount);

router.delete("/:userId",
    authorization(endpoint.deleteAccount),
    validation(validators.restoreAccount),
    userService.deleteAccount);

router.patch("/send-update-password",
    authentication(),
    validation(validators.sendUpdatePasswordCode),
    userService.sendUpdatePasswordCode);

router.patch("/verify-update-password",
    authentication(),
    validation(validators.verifyUpdatePassword),
    userService.verifyUpdatePasswordCode);

router.patch("/update-password",
    authentication(),
    validation(validators.updatePassword),
    userService.updatePassword);

router.patch("/send-update-email",
    authentication(),
    validation(validators.sendUpdateEmail),
    userService.sendUpdateEmail);

router.patch("/update-email",
    authentication(),
    validation(validators.updateEmail),
    userService.updateEmail);



export default router;