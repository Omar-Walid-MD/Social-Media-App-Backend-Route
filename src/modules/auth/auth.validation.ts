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

export const signupWithGmail = {
    body: z.strictObject({
        idToken: z.string(),
    })
} 

export const sendForgotPasswordCode = resendConfirmEmail;

export const verifyForgotPassword = {
    body: sendForgotPasswordCode.body.extend({
        otp: generalFields.otp,
    })
}

export const resetForgotPassword = {
    body: verifyForgotPassword.body.extend({
        password: generalFields.password,
        confirmPassword: generalFields.confirmPassword
    }).refine((data)=>{
        return data.password === data.confirmPassword;
    },{message:"Password mistmatch confirmPassword",path:["confirmPassword"]})
}

export const enableVerification = {
    body: z.strictObject({
        otp: generalFields.otp,
    })
}

export const confirmLogin = {
    body: login.body.extend({
        otp: generalFields.otp
    })
}
