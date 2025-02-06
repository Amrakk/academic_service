import type { ObjectId } from "mongooat";

export interface IGrade {
    _id: ObjectId;
    studentId: ObjectId;
    subjectId: ObjectId;
    gradeTypeId: ObjectId;
    value: number;
    comment?: string;
    updatedAt: Date;
    createdAt: Date;
}
