import { compare, hash } from "bcrypt"

export const generateHash = async(
    plaintext: string,
    saltRound: number = Number(process.env.SALT)
): Promise<string> => {
    return await hash(plaintext,saltRound);
}

export const compareHash = async(
    plaintext: string,
    hash: string
): Promise<boolean> => {
    return await compare(plaintext,hash);
}
