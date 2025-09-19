import { RoleEnum } from "../../db/models/User.model";

export const endpoint = {
    restoreComment: [RoleEnum.admin],
}