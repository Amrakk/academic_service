import type { ObjectId } from "mongooat";
import type { GROUP_TYPE, PROFILE_ROLE, ROLL_CALL_STATUS } from "../../constants.js";

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

    export interface EditRelationships {
        profiles: (string | ObjectId)[];
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

    export interface SendInvitationMails {
        emails: string[];
        groupId: string | ObjectId;
        groupType: GROUP_TYPE;
        role: PROFILE_ROLE;
        profileId?: string | ObjectId;
        expireMinutes?: number;
    }

    export interface RemoveInvitation {
        email: string;
        groupId: string | ObjectId;
        groupType: GROUP_TYPE;
    }
}

// Roll-call
export namespace IReqRollCall {
    export interface GetSessions {
        startDate?: Date;
        endDate?: Date;
    }
    export interface CreateSession {
        date?: Date;
    }

    export interface InsertEntry {
        profileId: string | ObjectId;
        status: ROLL_CALL_STATUS;
        remarks?: string;
    }

    export interface UpdateEntry {
        status: ROLL_CALL_STATUS;
        remarks?: string;
    }
}

// Party
export namespace IReqParty {
    export interface Insert {
        name: string;
        description?: string;
        memberIds: (string | ObjectId)[];
    }

    export interface Update {
        name?: string;
        description?: string;
    }

    export interface UpsertRemove {
        memberIds: (string | ObjectId)[];
    }
}

// Subject
export namespace IReqSubject {
    export interface Insert {
        name: string;
        gradeTypes: string[];
        avatarUrl?: string;
        description?: string;
    }

    export interface Update {
        name?: string;
        avatarUrl?: string;
        description?: string;
    }
}

// Grade
export namespace IReqGrade {
    export interface Insert {
        studentId: string | ObjectId;
        gradeTypeId: string | ObjectId;
        value: number;
        comment?: string;
    }

    export interface Update {
        value?: number;
        comment?: string;
    }
}

// News
export namespace IReqNews {
    export interface Query extends ITimeBasedPagination, IReqNews.Filter {}

    export interface Filter {
        targetRoles?: PROFILE_ROLE[];
    }

    export interface Insert {
        content: string;
        imageUrl?: string;
        targetRoles?: PROFILE_ROLE[];
    }

    export interface Update {
        content?: string;
        imageUrl?: string;
        targetRoles?: PROFILE_ROLE[];
    }
}

// Comments
export namespace IReqComment {
    export interface Upsert {
        content: string;
    }
}
