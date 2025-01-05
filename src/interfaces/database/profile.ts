import type { ObjectId } from "mongooat";

export interface IProfile {
    _id: ObjectId;
    createdAt: Date;
}
