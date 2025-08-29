import { EventEmitter } from "node:events";
import { sendEmail } from "../email/send.email";
import { verifyEmailTemplate } from "../email/templates/verify.email.template";
import Mail from "nodemailer/lib/mailer";
export const emailEvent = new EventEmitter();


interface IEmail extends Mail.Options {
    otp: number;
}

emailEvent.on("confirmEmail",async(data: IEmail)=>{

    try {
        data.subject = "Confirm Email";
        data.html = verifyEmailTemplate({
            otp: data.otp,
            title: "Confirm Email"
        })
        await sendEmail(data);

    } catch (error) {
        console.log("Failed to send email", error);
    }

})

emailEvent.on("sendResetPassword",async(data: IEmail)=>{

    try {
        data.subject = "Reset password";
        data.html = verifyEmailTemplate({
            otp: data.otp,
            title: "Reset password"
        })
        await sendEmail(data);

    } catch (error) {
        console.log("Failed to send email", error);
    }

})
