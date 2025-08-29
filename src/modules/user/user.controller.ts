import { Router } from "express";
import userService from "./user.service";
import * as validators from "./user.validation";
import { validation } from "../../middleware/validation.middleware";
import { authentication } from "../../middleware/authentication.middleware";
import { TokenEnum } from "../../utils/security/token.security";

const router: Router = Router();

router.get("/",
    authentication(),
    userService.profile);

router.post("/logout",
    authentication(),
    validation(validators.logout),
    userService.logout);

router.post("/refresh-token",
    authentication(TokenEnum.refresh),
    userService.refreshToken);

export default router;