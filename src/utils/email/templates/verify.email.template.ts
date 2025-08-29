export const verifyEmailTemplate = ({otp,title}: {otp: number; title: string;}): string => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <style>
        body {
        font-family: Arial, sans-serif;
        background-color: #f7f7f7;
        margin: 0;
        padding: 0;
        }
        .container {
        max-width: 600px;
        margin: auto;
        background-color: #ffffff;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }
        .otp-code {
        font-size: 32px;
        font-weight: bold;
        letter-spacing: 6px;
        color: #2a7ae2;
        margin: 20px 0;
        }
        .footer {
        font-size: 12px;
        color: #777;
        margin-top: 40px;
        text-align: center;
        }
    </style>
    </head>
    <body>
    <div class="container">
        <h2>${title}</h2>
        <p>Hello,</p>
        <p>Use the following code to verify your email address:</p>
        <div class="otp-code">${otp}</div> <!-- Replace this with your OTP dynamically -->
        <p>This code is valid for 2 minutes. Please do not share it with anyone.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
        <div class="footer">
        &copy; 2025 OWMD. All rights reserved.
        </div>
    </div>
    </body>
    </html>
    `;
}