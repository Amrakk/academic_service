import type { ObjectId } from "mongooat";
import type { ROLL_CALL_STATUS } from "../../constants.js";

export interface IRollCallEntry {
    _id: ObjectId;
    sessionId: ObjectId;
    profileId: ObjectId;
    classId: ObjectId;
    status: ROLL_CALL_STATUS;
    remarks?: string;
    updatedAt: Date;
    createdAt: Date;
}

export interface IRollCallSession {
    _id: ObjectId;
    classId: ObjectId;
    date: Date;
    createdBy: ObjectId;
    updatedAt: Date;
    createdAt: Date;
}
