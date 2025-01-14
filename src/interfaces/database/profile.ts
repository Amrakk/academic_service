import type { ObjectId } from "mongooat";
import type { GROUP_TYPE, PROFILE_ROLE } from "../../constants.js";

export interface IProfile {
    _id: ObjectId;
    displayName: string;
    avatarUrl: string;
    userId?: ObjectId;
    groupId: ObjectId;
    groupType: GROUP_TYPE;
    roles: (string | ObjectId)[];
    updatedAt: Date;
    createdAt: Date;
}

export interface IProfileRolesBinder {
    _id: ObjectId;
    roles: PROFILE_ROLE[];
}
