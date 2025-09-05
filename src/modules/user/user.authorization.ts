import { RoleEnum } from "../../db/models/User.model";

export const endpoint = {
    profile: [RoleEnum.user, RoleEnum.admin],
    restoreAccount: [RoleEnum.admin],
    deleteAccount: [RoleEnum.admin]

}