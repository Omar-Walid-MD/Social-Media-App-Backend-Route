import { v4 as uuid } from "uuid";
import type { JwtPayload, Secret, SignOptions } from "jsonwebtoken";
import { sign, verify } from "jsonwebtoken";
import { HUserDocument, RoleEnum, UserModel } from "../../db/models/User.model";
import { BadRequestException, UnauthorizedException } from "../response/error.response";
import { UserRepository } from "../../db/repository/user.repository";
import { HTokenDocument, TokenModel } from "../../db/models/Token.model";
import { TokenRepository } from "../../db/repository/token.repository";


export enum SignatureLevelEnum {
    Bearer="Bearer",
    System="System"
}

export enum TokenEnum {
    access="access",
    refresh="refresh"
}

export enum LogoutEnum {
    only="only",
    all="all"
}

export const generateToken = async({
    payload,
    secret=process.env.ACCESS_USER_TOKEN_SIGNATURE as string,
    options={
        expiresIn:Number(process.env.ACCESS_TOKEN_EXPIRES_IN)
    }
}: {
    payload: object;
    secret?: Secret;
    options?: SignOptions;
}): Promise<string> => {
    return sign(payload,secret,options)
}

export const verifyToken = async({
    token,
    secret=process.env.ACCESS_USER_TOKEN_SIGNATURE as string
}: {
    token: string;
    secret?: Secret;
}): Promise<JwtPayload> => {
    return verify(token,secret) as JwtPayload;
}



export const detectSignatureLevel = async(role: RoleEnum = RoleEnum.user): Promise<SignatureLevelEnum> => {
    let signatureLevel: SignatureLevelEnum = SignatureLevelEnum.Bearer;

    switch (role) {
        case RoleEnum.admin:
            signatureLevel = SignatureLevelEnum.System;
            break;
    
        default:
            signatureLevel = SignatureLevelEnum.Bearer;
            break;
    }

    return signatureLevel;
}

export const getSignatures = async (signatureLevel: SignatureLevelEnum = SignatureLevelEnum.Bearer): Promise<{access_signature:string; refresh_signature:string}> => {

    let signatures: {access_signature:string, refresh_signature: string} = {access_signature: "", refresh_signature: ""};
    
    switch(signatureLevel)
    {
        case SignatureLevelEnum.System:
            signatures.access_signature = process.env.ACCESS_SYSTEM_TOKEN_SIGNATURE as string;
            signatures.refresh_signature = process.env.REFRESH_SYSTEM_TOKEN_SIGNATURE as string;
            break;
        default:
            signatures.access_signature = process.env.ACCESS_USER_TOKEN_SIGNATURE as string;
            signatures.refresh_signature = process.env.REFRESH_USER_TOKEN_SIGNATURE as string;
            break;
    }

    return signatures;
}

export const createLoginCredentials = async(user: HUserDocument) => {
    
    const signatureLevel = await detectSignatureLevel(user.role);
    let signatures = await getSignatures(signatureLevel);

    const jwtid = uuid();

    const access_token = await generateToken({
        payload: {_id: user._id},
        secret: signatures.access_signature,
        options: {
            jwtid,
            expiresIn: Number(process.env.ACCESS_TOKEN_EXPIRES_IN)
        }
    });

    const refresh_token = await generateToken({
        payload: {_id: user._id},
        secret: signatures.refresh_signature,
        options: {
            jwtid,
            expiresIn: Number(process.env.REFRESH_TOKEN_EXPIRES_IN)
        }
    });

    return {access_token,refresh_token};
}

export const decodeToken = async({
        authorization="",
        tokenType=TokenEnum.access
    }:
    {
        authorization: string;
        tokenType?: string;
    }
) => {

    const userModel = new UserRepository(UserModel);
    const tokenModel = new TokenRepository(TokenModel);

    const [bearer,token] = authorization?.split(" ") || [];
    if(!bearer || !token)
    {
        throw new UnauthorizedException("Missing token parts");
    }

    let signatures = await getSignatures(bearer as SignatureLevelEnum);
        
    const decoded = await verifyToken({
        token,
        secret: tokenType === TokenEnum.access
        ? signatures.access_signature
        : signatures.refresh_signature
    }) as JwtPayload;


    if(!decoded?._id || !decoded?.iat)
    {
        throw new BadRequestException("Invalid Token Payload");
    }

    if(await tokenModel.findOne({filter:{jti: decoded.jti}}))
    {
        throw new UnauthorizedException("Invalid or old login credentials");
    }

    const user = await userModel.findOne({
        filter: {
            id: decoded._id
        }
    });

    if(!user)
    {
        throw new BadRequestException("Not Registered Account")
    }

    if(user.changeCredentialsTime?.getTime() || 0 > (decoded.iat || 0)*1000)
    {
        throw new UnauthorizedException("Invalid or old login credentials");
    }

    return {user,decoded};

}


export const createRevokeToken = async(decoded: JwtPayload): Promise<HTokenDocument> => {

    const tokenModel = new TokenRepository(TokenModel);

    const [result] = await tokenModel.create({
        data: [{
            jti: decoded.jti as string,
            expiresIn: (decoded.iat as number) + Number(process.env.REFRESH_TOKEN_EXPIRES_IN as string),
            userId: decoded._id
        }]
    }) || [];

    if(!result) throw new BadRequestException("Failed to revoke this token");

    return result;
}

