import type { ObjectId } from "mongooat";
import type { GROUP_TYPE, PROFILE_ROLE } from "../../constants.js";

export interface IInvitation {
    _id: ObjectId;
    email: string;
    groupId: ObjectId;
    groupType: GROUP_TYPE;
    role: PROFILE_ROLE;
    schoolId?: ObjectId;
    profileId?: ObjectId;
    senderId: ObjectId;
    expiredAt: Date;
}
