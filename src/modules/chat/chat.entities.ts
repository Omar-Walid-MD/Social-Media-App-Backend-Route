import { HChatDocument } from "../../db/models";

export interface IGetChatResponse {
    chat: Partial<HChatDocument>
}