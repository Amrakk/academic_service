import type { ObjectId } from "mongooat";

export interface IComment {
    _id: ObjectId;
    newsId: ObjectId;
    content: string;
    creatorId: ObjectId;
    updatedAt: Date;
    createdAt: Date;
}
