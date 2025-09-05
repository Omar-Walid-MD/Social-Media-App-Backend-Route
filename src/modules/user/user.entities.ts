import { HUserDocument } from "../../db/models/User.model";

export interface IProfileImageResponse {
    url: string;
}

export interface IUserResponse {
    user: Partial<HUserDocument>
}