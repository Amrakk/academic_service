import { z } from "zod";
import mongooat from "../db.js";
import { ZodObjectId } from "mongooat";

const gradeSchema = z.object({
    studentId: ZodObjectId,
    subjectId: ZodObjectId,
    gradeTypeId: ZodObjectId,
    value: z.number(),
    comment: z.string().optional(),
    updatedAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
    createdAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const GradeModel = mongooat.Model("Grade", gradeSchema);

await GradeModel.dropIndexes();
await GradeModel.createIndex({ studentId: 1 });
await GradeModel.createIndex({ subjectId: 1 });
await GradeModel.createIndex({ studentId: 1, subjectId: 1, gradeTypeId: 1 }, { unique: true });
