import { z } from "zod";
import mongooat from "../db.js";
import { ZodObjectId } from "mongooat";
import { DEFAULT_CLASS_AVATAR_URL } from "../../constants.js";
import { toLowerNonAccentVietnamese } from "../../utils/removeDiacritics.js";

const classSchema = z.object({
    name: z.string().transform((val) => val.trim()),
    _name: z.string().transform((val) => toLowerNonAccentVietnamese(val.trim())),
    avatarUrl: z.string().default(DEFAULT_CLASS_AVATAR_URL),
    schoolId: ZodObjectId.optional(),
    creatorId: ZodObjectId,
    updatedAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
    createdAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const ClassModel = mongooat.Model("Class", classSchema);

await ClassModel.dropIndexes();
await ClassModel.createIndex({ schoolId: 1 });
await ClassModel.createIndex({ creatorId: 1 });
