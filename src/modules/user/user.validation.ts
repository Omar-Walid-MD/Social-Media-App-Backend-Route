import {email, z} from "zod";
import { LogoutEnum } from "../../utils/security/token.security";
import { Types } from "mongoose";
import { generalFields } from "../../middleware/validation.middleware";

export const logout = {
    body: z.strictObject({
        flag: z.enum(LogoutEnum).default(LogoutEnum.only)
    })
}

export const updateBasicInfo = {
    body: z.strictObject({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        gender: z.string().optional(),
        phone: z.string().optional()
    })
}

export const freezeAccount = {
    params: z.object({
        userId: z.string().optional()
    }).optional().refine(data=>{

        return data?.userId ? Types.ObjectId.isValid(data.userId) : true;

    },{error:"Invalid ObjectId format",path:["userId"]})
}

export const restoreAccount = {
    params: z.object({
        userId: z.string()
    }).refine(data=>{

        return Types.ObjectId.isValid(data.userId);

    },{error:"Invalid ObjectId format",path:["userId"]})
}

export const sendUpdatePasswordCode = {
    body: z.strictObject({
        email: generalFields.email,
        password: generalFields.password,
        confirmPassword: generalFields.confirmPassword
    }).refine((data)=>{
        return data.password === data.confirmPassword;
    },{message:"Password mistmatch confirmPassword",path:["confirmPassword"]})
}

export const verifyUpdatePassword = {
    body: z.strictObject({
        email: generalFields.email,
        otp: generalFields.otp
    })
}

export const updatePassword = {
    body: verifyUpdatePassword.body.extend({
        oldPassword: generalFields.password,
        password: generalFields.password,
        confirmPassword: generalFields.confirmPassword
    }).superRefine((data,ctx)=>{

        if(data.password !== data.confirmPassword)
        {
            ctx.addIssue({
                code: "custom",
                message:"Password mistmatch confirmPassword",
                path:["confirmPassword"]
            })
        }

        if(data.password === data.oldPassword)
        {
            ctx.addIssue({
                code: "custom",
                message:"New password cannot be the same as old password",
                path:["password"]
            })
        }
    })
}

export const sendUpdateEmail = {
    body: z.strictObject({
        email: generalFields.email,
        newEmail: generalFields.email,
        password: generalFields.password,
        confirmPassword: generalFields.confirmPassword
    }).refine((data)=>{
        return data.password === data.confirmPassword;
    },{message:"Password mistmatch confirmPassword",path:["confirmPassword"]})
}

export const updateEmail = {
    body: z.strictObject({
        email: generalFields.email,
        newEmail: generalFields.email,
        otp: generalFields.otp,
        password: generalFields.password,
        confirmPassword: generalFields.confirmPassword
    }).refine((data)=>{
        return data.password === data.confirmPassword;
    },{message:"Password mistmatch confirmPassword",path:["confirmPassword"]})
}

export const deleteAccount = restoreAccount;