import {z} from "zod";
import { Request, Response, NextFunction } from "express"
import { ZodError, ZodType } from "zod"
import { BadRequestException } from "../utils/response/error.response";
import { Types } from "mongoose";

type KeyReqType = keyof Request;
type SchemaType = Partial<Record<KeyReqType, ZodType>>;
type ValidationErrorsType = {
    key: KeyReqType;
    issues: {
        message: string;
        path: (string | number | symbol | undefined)[];
    }[];
}[];

export const validation = (schema: SchemaType) => {
    return (req: Request, res: Response, next: NextFunction): NextFunction => {
        
        const validationErrors: ValidationErrorsType  = [];
        
        for (const key of Object.keys(schema) as KeyReqType[])
        {
            if(!schema[key]) continue;

            if(req.file)
            {
                req.body.attachment = req.file;
            }

            if(req.files)
            {
                req.body.attachments = req.files;
            }

            const validationResult = schema[key].safeParse(req[key]);
            if(!validationResult.success)
            {
                const errors = validationResult.error as unknown as ZodError;
                validationErrors.push({
                    key,
                    issues: errors.issues.map(issue => ({message:issue.message,path:issue.path}))
                });
            }
        }

        if(validationErrors.length)
        {
            throw new BadRequestException("Validation Error",validationErrors);
        }


        return next() as unknown as NextFunction;
    }
}



export const generalFields = {
    username: z.string().min(2).max(20),
    email: z.email(),
    password: z.string(),
    confirmPassword: z.string(),
    otp: z.string().regex(/^\d{6}$/),
    file: function(mimetype: string[])
    {
        return z.strictObject({
            fieldname: z.string(),
            originalname: z.string(),
            encoding: z.string(),
            mimetype: z.enum(mimetype),
            buffer: z.any().optional(),
            path: z.string().optional(),
            size: z.number()
        })
        .refine((data)=>{  
            return data.buffer || data.path ? true : false;
        },{error:"Buffer or Path is required"})
    },

    id: z.string().refine(data=>{
        return Types.ObjectId.isValid(data);
    },
    {error: "Tag must be valid ObjectId"}
    )
    
}