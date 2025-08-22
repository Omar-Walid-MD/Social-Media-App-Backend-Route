import { Router } from "express";
import authService from "./auth.service";
import * as validators from "./auth.validation";
import { validation } from "../../middleware/validation.middleware";

const router: Router = Router();

router.post("/signup",
    validation(validators.signup),
    authService.signup);
    
router.post("/login",
    validation(validators.login),
    authService.login);

router.patch("/confirm-email",
    validation(validators.confirmEmail),
    authService.confirmEmail);

router.patch("/resend-email",
    validation(validators.resendConfirmEmail),
    authService.resendEmail);

export default router;