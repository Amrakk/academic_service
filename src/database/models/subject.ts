import { z } from "zod";
import mongooat from "../db.js";
import { ObjectId, ZodObjectId } from "mongooat";
import { DEFAULT_SUBJECT_AVATAR_URL } from "../../constants.js";
import { toLowerNonAccentVietnamese } from "../../utils/removeDiacritics.js";

const gradeTypeSchema = z.object({
    _id: ZodObjectId.default(() => new ObjectId()),
    name: z.string(),
});

const subjectSchema = z.object({
    classId: ZodObjectId,
    name: z.string().transform((val) => val.trim()),
    _name: z.string().transform((val) => toLowerNonAccentVietnamese(val.trim())),
    avatarUrl: z.preprocess(
        (val) => (typeof val === "string" && val === "" ? undefined : val),
        z.string().default(DEFAULT_SUBJECT_AVATAR_URL)
    ),
    gradeTypes: z.array(gradeTypeSchema),
    description: z.string().optional(),
    updatedAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
    createdAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const SubjectModel = mongooat.Model("Subject", subjectSchema);

await SubjectModel.dropIndexes();
await SubjectModel.createIndex({ _name: 1 }, { unique: true });
