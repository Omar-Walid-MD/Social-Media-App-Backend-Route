import { EventEmitter } from "node:events";
import { sendEmail } from "../email/send.email";
import { verifyEmailTemplate } from "../email/templates/verify.email.template";
import Mail from "nodemailer/lib/mailer";
import { HPostDocument } from "../../db/models/Post.model";
import { HUserDocument } from "../../db/models/User.model";
import { tagEmailTemplate } from "../email/templates/tag.email.template";
export const emailEvent = new EventEmitter();


interface IOTPEmail extends Mail.Options {
    otp: number;
}

interface ITagEmail extends Mail.Options {
    post: HPostDocument,
    user: HUserDocument
}

emailEvent.on("confirmEmail",async(data: IOTPEmail)=>{

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

emailEvent.on("sendResetPassword",async(data: IOTPEmail)=>{

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
});

emailEvent.on("sendUpdatePassword",async(data: IOTPEmail)=>{

    try {
        data.subject = "Update Password";
        data.html = verifyEmailTemplate({
            otp: data.otp,
            title: "Update Password"
        })
        await sendEmail(data);

    } catch (error) {
        console.log("Failed to send email", error);
    }
});

emailEvent.on("sendTagEmail",async(data: ITagEmail)=>{

    try {
        data.subject = "You were tagged in a post!";
        data.html = tagEmailTemplate({
            post: data.post,
            user: data.user
        })
        await sendEmail(data);

    } catch (error) {
        console.log("Failed to send email", error);
    }
});

emailEvent.on("sendEnableVerification",async(data: IOTPEmail)=>{

    try {
        data.subject = "Enable 2 Step Verification";
        data.html = verifyEmailTemplate({
            otp: data.otp,
            title: "Enable 2 Step Verification"
        })
        await sendEmail(data);

    } catch (error) {
        console.log("Failed to send email", error);
    }
});