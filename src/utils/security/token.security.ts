import jwt from "jsonwebtoken";
import { JwtPayload } from "jsonwebtoken";
import { UserModel } from "../../db/models/User.model";
import * as DBService from "../../db/service/db.service";
import { NextFunction } from "express";

export const signatureLevelEnum = {bearer:"Bearer",system:"System"};
export const tokenTypeEnum = {access:"access",refresh:"refresh"};
export const logoutEnum = {signOutFromAllDevices:"signOutFromAllDevices",signOut:"signOut",stayLoggedIn:"stayLoggedIn"};

type SignaturesObjectType = {
    accessSignature: string;
    refreshSignature: string;
}

interface UserJWTPayload extends JwtPayload
{
    _id: string;
}

type UserType = {
    _id: string,
    username: string;
    email: string;
    password: string;
    confirmEmail?: Date;
    confirmEmailOtp?: any;
}


export const generateToken = async({payload={}, signature=process.env.ACCESS_USER_TOKEN_SIGNATURE, options={expiresIn:Number(process.env.ACCESS_TOKEN_EXPIRES_IN)}}={}) => {
    return jwt.sign(payload,signature as string,options);
}

export const verifyToken = async({token="", signature=process.env.ACCESS_USER_TOKEN_SIGNATURE}={}) => {
    try {
        return jwt.verify(token,signature as string);
    } catch (error) {
        return undefined;
    }
}

export const getSignatures = async ({signatureLevel=signatureLevelEnum.bearer}={}) => {
    let signatures: SignaturesObjectType = {accessSignature: "", refreshSignature: ""};
    switch(signatureLevel)
    {
        case signatureLevelEnum.system:
            signatures.accessSignature = process.env.ACCESS_SYSTEM_TOKEN_SIGNATURE as string;
            signatures.refreshSignature = process.env.REFRESH_SYSTEM_TOKEN_SIGNATURE as string;
            break;
        default:
            signatures.accessSignature = process.env.ACCESS_USER_TOKEN_SIGNATURE as string;
            signatures.refreshSignature = process.env.REFRESH_USER_TOKEN_SIGNATURE as string;
            break;
    }

    return signatures;
}

export const decodedToken = async({
        authorization="",
        next,
        tokenType=tokenTypeEnum.access
    }:
    {
        authorization: string;
        next: NextFunction;
        tokenType: string;
    }
) => {

    const [bearer,token] = authorization?.split(" ") || [];
    if(!bearer || !token)
    {
        return next(new Error("missing token parts",{ cause:401 }));
    }

    let signatures = await getSignatures({signatureLevel:bearer});
        
    const decoded = await verifyToken({
        token,
        signature: tokenType === tokenTypeEnum.access ? signatures.accessSignature : signatures.refreshSignature
    }) as UserJWTPayload;


    if(!decoded?._id)
    {
        return next(new Error("Invalid token",{cause:400}));
    }

    const user = await DBService.findById({
        model: UserModel,
        id: decoded._id
    });

    if(!user)
    {
        return next(new Error("Not registered account",{cause:404}));
    }

    if(user.changeCredentialsTime?.getTime() > (decoded.iat || 0)*1000)
    {
        return next(new Error("Invalid login credentials",{cause:401}));
    }

    return {user,decoded};

}

export const generateLoginCredentials = async({user}: {user: UserType}) => {
    
    let signatures = await getSignatures({signatureLevel:signatureLevelEnum.bearer});

    // const jwtid = nanoid();

    const access_token = await generateToken(
    {
        payload: {_id:user._id},
        signature: signatures.accessSignature,
        options: {
            expiresIn: Number(process.env.ACCESS_TOKEN_EXPIRES_IN),
            // jwtid
        }
    });

    const refresh_token = await generateToken(
    {
        payload: {_id:user._id},
        signature: signatures.refreshSignature,
        options: {
            expiresIn: Number(process.env.REFRESH_TOKEN_EXPIRES_IN),
            // jwtid
        }
    });

    return {access_token,refresh_token};
}

