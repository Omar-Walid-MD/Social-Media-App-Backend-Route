import { HPostDocument } from "../../../db/models/Post.model";
import { HUserDocument } from "../../../db/models/User.model";

export const tagEmailTemplate = ({post,user}: {post: HPostDocument; user: HUserDocument;}): string => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8" />
        <title>You were tagged in a post</title>
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
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .post-box {
            background-color: #f0f4ff;
            border-left: 4px solid #2a7ae2;
            padding: 15px;
            margin: 20px 0;
            border-radius: 6px;
            font-size: 15px;
            color: #333;
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
        <h2>Hello ${user.username},</h2>
        <p>You’ve been <strong>tagged</strong> in a post:</p>
        <div class="post-box">
            ${post.content || ""}
        </div>
        <p>If you don’t want to receive these notifications, you can adjust your preferences in your account settings.</p>
        <div class="footer">
            &copy; 2025 Your Company. All rights reserved.
        </div>
        </div>
    </body>
    </html>
    `;
}