import { z } from "zod";
import mongooat from "../db.js";
import { ZodObjectId } from "mongooat";
import { DEFAULT_PROFILE_AVATAR_URL, GROUP_TYPE } from "../../constants.js";
import { toLowerNonAccentVietnamese } from "../../utils/removeDiacritics.js";

export const groupTypeSchema = z.preprocess((val) => parseInt(`${val}`), z.nativeEnum(GROUP_TYPE));

export const profileSchema = z.object({
    displayName: z.string().transform((val) => val.trim()),
    _displayName: z.string().transform((val) => toLowerNonAccentVietnamese(val.trim())),
    avatarUrl: z.string().default(DEFAULT_PROFILE_AVATAR_URL),
    userId: ZodObjectId.optional(),
    groupId: ZodObjectId,
    groupType: groupTypeSchema,
    roles: z.array(ZodObjectId).nonempty(),
    updatedAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
    createdAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const ProfileModel = mongooat.Model("Profile", profileSchema);

await ProfileModel.dropIndexes();
await ProfileModel.createIndex({ userId: 1 });
await ProfileModel.createIndex({ groupId: 1 });
