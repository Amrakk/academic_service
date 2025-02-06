import type { ObjectId } from "mongooat";

export interface ISubject {
    _id: ObjectId;
    classId: ObjectId;
    name: string;
    avatarUrl: string;
    gradeTypes: IGradeType[];
    description?: string;
    updatedAt: Date;
    createdAt: Date;
}

export interface IGradeType {
    _id: ObjectId;
    name: string;
}
