import { EventEmitter } from "events";
import { sendEmail } from "../email/send.email";
import { verifyEmailTemplate } from "../email/templates/verify.email.template";
export const emailEvent = new EventEmitter();

emailEvent.on("confirmEmail",async(data)=>{
    await sendEmail({to: data.to, subject: data.subject || "Confirm Email", html: verifyEmailTemplate({otp:data.otp})})
    .catch((error)=>{
        console.log(error);
    })
})

emailEvent.on("sendForgotPassword",async(data)=>{
    await sendEmail({to: data.to, subject: data.subject || "Forgot Password", html: verifyEmailTemplate({otp:data.otp,title:data.title})})
    .catch((error)=>{
        console.log(error);
    })
})