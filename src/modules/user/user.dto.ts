import {z} from "zod";
import { deleteAccount, freezeAccount, logout, restoreAccount } from "./user.validation";
import * as validators from "./user.validation";

export type ILogoutBodyInputsDTO = z.infer<typeof logout.body>;
export type IFreezeAccountInputsDTO = z.infer<typeof freezeAccount.params>;
export type IRestoreAccountInputsDTO = z.infer<typeof restoreAccount.params>;
export type IDeleteAccountInputsDTO = z.infer<typeof deleteAccount.params>;

export type IUpdateInfoBodyInputsDTO = z.infer<typeof validators.updateBasicInfo.body>;

export type ISendUpdateEmailBodyInputsDTO = z.infer<typeof validators.sendUpdateEmail.body>;
export type IUpdateEmailBodyInputsDTO = z.infer<typeof validators.updateEmail.body>;

export type ISendUpdateCodeBodyInputsDTO = z.infer<typeof validators.sendUpdatePasswordCode.body>;
export type IVerifyUpdateCodeBodyInputsDTO = z.infer<typeof validators.verifyUpdatePassword.body>;
export type IUpdatePasswordBodyInputsDTO = z.infer<typeof validators.updatePassword.body>;
