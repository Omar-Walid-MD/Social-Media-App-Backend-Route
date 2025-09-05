import { Router } from "express";
import userService from "./user.service";
import * as validators from "./user.validation";
import { validation } from "../../middleware/validation.middleware";
import { authentication, authorization } from "../../middleware/authentication.middleware";
import { TokenEnum } from "../../utils/security/token.security";
import { cloudFileUpload, fileValidation, StorageEnum } from "../../utils/multer/cloud.multer";
import { endpoint } from "./user.authorization";

const router: Router = Router();

router.get("/",
    authentication(),
    userService.profile);

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

export default router;