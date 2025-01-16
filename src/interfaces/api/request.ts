import type { ObjectId } from "mongooat";
import type { GROUP_TYPE, PROFILE_ROLE } from "../../constants.js";

export interface IOffsetPagination {
    page?: number;
    limit?: number;
}

export interface ITimeBasedPagination {
    from?: Date;
    limit?: number;
}

// Profile
export namespace IReqProfile {
    export interface Query {
        roles?: PROFILE_ROLE[];
    }

    export interface Insert {
        _id?: string | ObjectId;
        displayName: string;
        roles: PROFILE_ROLE[];
        avatarUrl?: string;
        userId?: string | ObjectId;
    }

    export interface Update {
        avatarUrl?: string;
        displayName?: string;
        roles?: PROFILE_ROLE[];
        userId?: string | ObjectId;
    }
}

// School
export namespace IReqSchool {
    export interface Insert {
        _id?: string | ObjectId;
        name: string;
        address?: string;
        phoneNumber?: string;
        avatarUrl?: string;
    }

    export interface Update {
        name?: string;
        address?: string;
        phoneNumber?: string;
        avatarUrl?: string;
    }
}

// Class
export namespace IReqClass {
    export interface Insert {
        _id?: string | ObjectId;
        name: string;
        avatarUrl?: string;
    }

    export interface Update {
        name?: string;
        avatarUrl?: string;
    }
}

// Invitation
export namespace IReqInvitation {
    export interface GetGroupCode {
        groupId: string | ObjectId;
        groupType: GROUP_TYPE;
        newProfileRole: PROFILE_ROLE;
        expireMinutes?: number;
    }
}
