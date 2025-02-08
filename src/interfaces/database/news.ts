import type { ObjectId } from "mongooat";

export interface INews {
    _id: ObjectId;
    content: string;
    imageUrl?: string;
    targetRoles: ObjectId[];
    creatorId: ObjectId;
    groupId: ObjectId;
    updatedAt: Date;
    createdAt: Date;
}
