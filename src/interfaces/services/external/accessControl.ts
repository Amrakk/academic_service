import type { ObjectId } from "mongooat";
import type { RELATIONSHIP, SOCIAL_MEDIA_PROVIDER, USER_ROLE, USER_STATUS } from "../../../constants.js";

export interface IRelationGroups<T = ObjectId> {
    mandatory: T[];
    optional: T[];
}

export interface IRole {
    _id: ObjectId;
    name: string;
    isLocked: boolean;
    privileges: IRelationGroups;
    parents: IRelationGroups;
}

export interface IRoleSimplified extends Omit<IRole, "privileges" | "parents"> {}

export interface IPolicy {
    action: string;
    relationship: string;
    isLocked: boolean;
}

export interface IRelationship {
    _id: ObjectId;
    from: ObjectId;
    to: ObjectId;
    relationship: string;
}

export namespace IReqAccess {
    export interface Authorize {
        fromId: ObjectId | string;
        fromRoleIds: (string | ObjectId)[];
        toId: ObjectId | string;
        action: string;
    }

    export interface Node {
        role: {
            name: string;
            privileges: NodePrivilege[];
        };
        child: Node[];
    }

    export type NodePrivilege = {
        action: string;
        relationship: string;
    };

    export interface Register {
        roles?: Node[];
    }
}

export namespace IReqRelationship {
    export interface Condition {
        fromRel: RELATIONSHIP;
        toRel: RELATIONSHIP;
        resultRel: RELATIONSHIP;
    }

    export interface EntityRelationship {
        entityId: string | ObjectId;
        relationship: RELATIONSHIP;
    }

    export interface Bind {
        initiators: EntityRelationship[];
        targetId: string | ObjectId;
        conditions: Condition[];
    }

    export interface Unbind {
        terminators: EntityRelationship[];
        targetId: string | ObjectId;
        isTargetUnbound?: boolean;
        conditions: Condition[];
    }

    export interface Query {
        relationships: string[];
    }

    export interface UpsertDel {
        from: ObjectId | string;
        to: ObjectId | string;
        relationship: string;
    }

    export interface DeleteByIds {
        ids: (string | ObjectId)[];
    }
}

export interface IUser {
    _id: ObjectId;
    name: string;
    email: string;
    phoneNumber?: string;
    avatarUrl: string;
    role: USER_ROLE;
    status: USER_STATUS;
    socialMediaAccounts: ISocialMediaAccount[];
    createdAt: Date;
    updatedAt: Date;
}

interface ISocialMediaAccount {
    provider: SOCIAL_MEDIA_PROVIDER;
    accountId: string;
}
