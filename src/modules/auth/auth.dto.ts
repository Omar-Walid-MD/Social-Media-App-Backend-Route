import * as validators from "./auth.validation";
import {z} from "zod";

export type ISignUpBodyInputsDTO = z.infer<typeof validators.signup.body>;