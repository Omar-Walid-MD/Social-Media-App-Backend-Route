import {z} from "zod";
import { deleteAccount, freezeAccount, logout, restoreAccount } from "./user.validation";

export type ILogoutBodyInputsDTO = z.infer<typeof logout.body>;
export type IFreezeAccountInputsDTO = z.infer<typeof freezeAccount.params>;
export type IRestoreAccountInputsDTO = z.infer<typeof restoreAccount.params>;
export type IDeleteAccountInputsDTO = z.infer<typeof deleteAccount.params>;