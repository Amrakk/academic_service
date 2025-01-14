import type { ObjectId } from "mongooat";

export interface ISchool {
    _id: ObjectId;
    name: string;
    address?: string;
    phoneNumber?: string;
    avatarUrl: string;
    creatorId: ObjectId;
    updatedAt: Date;
    createdAt: Date;
}
