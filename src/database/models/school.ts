import { z } from "zod";
import mongooat from "../db.js";
import { ZodObjectId } from "mongooat";
import { DEFAULT_SCHOOL_AVATAR_URL } from "../../constants.js";
import { toLowerNonAccentVietnamese } from "../../utils/removeDiacritics.js";

const schoolSchema = z.object({
    name: z.string().transform((val) => val.trim()),
    _name: z.string().transform((val) => toLowerNonAccentVietnamese(val.trim())),
    address: z.string().optional(),
    phoneNumber: z.string().optional(),
    avatarUrl: z.preprocess(
        (val) => (typeof val === "string" && val === "" ? undefined : val),
        z.string().default(DEFAULT_SCHOOL_AVATAR_URL)
    ),
    creatorId: ZodObjectId,
    updatedAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
    createdAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const SchoolModel = mongooat.Model("School", schoolSchema);

await SchoolModel.dropIndexes();
await SchoolModel.createIndex({ creatorId: 1 });
await SchoolModel.createIndex({ _name: 1 }, { unique: true });
