import type { ObjectId } from "mongooat";
import type BaseError from "../../errors/BaseError.js";
import type { IProfile } from "../database/profile.js";
import type { RESPONSE_CODE, RESPONSE_MESSAGE } from "../../constants.js";

// CORE RESPONSE INTERFACE
export interface IResponse<T = undefined> {
    /** Response code */
    code: RESPONSE_CODE;
    /** Response message */
    message: RESPONSE_MESSAGE;
    /** Response data */
    data?: T;
    /** Error details */
    error?: BaseError | Record<string, unknown> | Array<unknown>;
}

export namespace IResGetAll {
    export interface Profile {
        profiles: IProfile[];
        totalDocuments: number;
    }
}

export interface IResNews {
    _id: ObjectId;
    content: string;
    imageUrl?: string;
    targetRoles: ObjectId[];
    creator: {
        _id: ObjectId;
        displayName: string;
        avatarUrl: string;
    };
    groupId: ObjectId;
    updatedAt: Date;
    createdAt: Date;
}

export interface IResComment {
    _id: ObjectId;
    newsId: ObjectId;
    content: string;
    creator: {
        _id: ObjectId;
        displayName: string;
        avatarUrl: string;
    };
    updatedAt: Date;
    createdAt: Date;
}
