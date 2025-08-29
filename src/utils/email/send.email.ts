import {createTransport, Transporter } from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { BadRequestException } from "../response/error.response";

export const sendEmail = async(data: Mail.Options): Promise<void> =>
{

	if(!data.html && !data.attachments?.length && !data.text)
	{
		throw new BadRequestException("Missing Email content");
	}

	const transporter:
	Transporter<
		SMTPTransport.SentMessageInfo,
		SMTPTransport.Options
	>
	= createTransport({
		host: process.env.EMAIL_HOST,
		port: 587,
		secure: false,
		auth: {
			user: process.env.EMAIL_USER as string,
			pass: process.env.EMAIL_PASS as string,
		},
	});

	await transporter.sendMail({
		...data,
		from: `${process.env.APPLICATION_NAME} <${process.env.EMAIL_USER as string}>`,
	});
}