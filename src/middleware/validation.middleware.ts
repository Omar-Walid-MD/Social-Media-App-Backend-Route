import {z} from "zod";
import { Request, Response, NextFunction } from "express"
import { ZodError, ZodType } from "zod"
import { BadRequestException } from "../utils/response/error.response";

type KeyReqType = keyof Request;
type SchemaType = Partial<Record<KeyReqType, ZodType>>;
type ValidationErrorsType = {
    key: KeyReqType;
    issues: {
        message: string;
        path: string | number | symbol | undefined;
    }[];
}[];

export const validation = (schema: SchemaType) => {
    return (req: Request, res: Response, next: NextFunction): NextFunction => {
        
        const validationErrors: ValidationErrorsType  = [];
        
        for (const key of Object.keys(schema) as KeyReqType[])
        {
            if(!schema[key]) continue;

            const validationResult = schema[key].safeParse(req[key]);
            if(!validationResult.success)
            {
                const errors = validationResult.error as unknown as ZodError;
                validationErrors.push({
                    key,
                    issues: errors.issues.map(issue => ({message:issue.message,path:issue.path[0]}))
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
    otp: z.string().regex(/^\d{6}$/)
}