import {z} from "zod";
import { logout } from "./user.validation";

export type ILogoutBodyInputsDTO = z.infer<typeof logout.body>;