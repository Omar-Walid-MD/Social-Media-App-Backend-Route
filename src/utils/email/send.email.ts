import nodemailer from "nodemailer";

export async function sendEmail({ from = process.env.EMAIL_USER, to="", cc="", bcc="", text="", html="", subject="Saraha App", attachments=[] } = {})
{
	const transporter = nodemailer.createTransport({
		host: process.env.EMAIL_HOST,
		port: 587,
		secure: false,
		auth: {
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASS,
		},
	});

	await transporter.sendMail({
		from: `Social Media App <${from}>`,
		to, cc, bcc, text, html, subject, attachments
	});
}