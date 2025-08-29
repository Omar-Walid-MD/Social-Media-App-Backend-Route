import * as validators from "./auth.validation";
import {z} from "zod";

export type ISignUpBodyInputsDTO = z.infer<typeof validators.signup.body>;
export type ILoginBodyInputsDTO = z.infer<typeof validators.login.body>;
export type IGmail = z.infer<typeof validators.signupWithGmail.body>;
export type IConfirmEmailBodyInputsDTO = z.infer<typeof validators.confirmEmail.body>;

export type IForgotCodeBodyInputsDTO = z.infer<typeof validators.sendForgotPasswordCode.body>;
export type IVerifyForgotCodeBodyInputsDTO = z.infer<typeof validators.verifyForgotPassword.body>;
export type IResetForgotCodeBodyInputsDTO = z.infer<typeof validators.resetForgotPassword.body>;


