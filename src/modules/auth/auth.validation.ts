import {z} from "zod";
import { generalFields } from "../../middleware/validation.middleware";

export const login = {
    body: z.strictObject({
        email: generalFields.email,
        password: generalFields.password,
    })
}


export const signup = {
    body: login.body.extend({
        username: generalFields.username,
        confirmPassword: generalFields.confirmPassword
    }).superRefine((data,ctx)=>{
        
        if(data.password !== data.confirmPassword) ctx.addIssue({
            code: "custom",
            path: ["confirmPassword"],
            message: "Password mistmatch confirm password"
        });

        if(data.username?.split(" ").length !== 2) ctx.addIssue({
            code: "custom",
            path: ["username"],
            message: "Username is not of 2 parts"
        });
    })
}


export const confirmEmail = {
    body: z.strictObject({
        email: generalFields.email,
        otp: generalFields.otp,
    })
}

export const resendConfirmEmail = {
    body: z.strictObject({
        email: generalFields.email,
    })
}