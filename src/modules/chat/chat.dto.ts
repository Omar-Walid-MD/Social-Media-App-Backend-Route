import {z} from "zod";
import { IMainDTO } from "../gateway";
import { createChattingGroup, getChat, getChattingGroup } from "./chat.validations";

export type IGetChatParamsDTO = z.infer<typeof getChat.params>;
export type IGetChatQueryDTO = z.infer<typeof getChat.query>;
export type ICreateChattingGroupBodyDTO = z.infer<typeof createChattingGroup.body>;


export type IGetChattingGroupParamsDTO = z.infer<typeof getChattingGroup.params>;
export type IGetChattingGroupQueryDTO = z.infer<typeof getChattingGroup.query>;

export interface ISayHiDTO extends IMainDTO {
    message: string;
}
export interface ISendMessageDTO extends IMainDTO {
    content: string;
    sendTo: string;
}

export interface IJoinRoomDTO extends IMainDTO {
    roomId: string;
}

export interface ISendGroupMessageDTO extends IMainDTO {
    content: string;
    groupId: string;
}

export interface ISetTypingDTO extends IMainDTO {
    typing: boolean;
    groupId?: string;
    sendTo?: string;
}