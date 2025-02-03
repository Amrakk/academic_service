import type { ObjectId } from "mongooat";

export interface IParty {
    _id: ObjectId;
    classId: ObjectId;
    name: string;
    description?: string;
    memberIds: ObjectId[];
    createdBy: ObjectId;
    updatedAt: Date;
    createdAt: Date;
}
