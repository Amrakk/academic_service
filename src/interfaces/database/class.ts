import type { ObjectId } from "mongooat";

export interface IClass {
    _id: ObjectId;
    name: string;
    avatarUrl: string;
    schoolId?: ObjectId;
    creatorId: ObjectId;
    updatedAt: Date;
    createdAt: Date;
}
