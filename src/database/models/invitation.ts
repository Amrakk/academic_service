import { z } from "zod";
import mongooat from "../db.js";
import { ZodObjectId } from "mongooat";
import { groupTypeSchema } from "./profile.js";
import { PROFILE_ROLE } from "../../constants.js";

const invitationSchema = z.object({
    email: z.string().email(),
    groupId: ZodObjectId,
    groupType: groupTypeSchema,
    role: z.nativeEnum(PROFILE_ROLE),
    schoolId: ZodObjectId.optional(),
    profileId: ZodObjectId.optional(),
    senderId: ZodObjectId,
    expiredAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const InvitationModel = mongooat.Model("Invitation", invitationSchema);

await InvitationModel.dropIndexes();
await InvitationModel.createIndex({ email: 1 });
await InvitationModel.createIndex({ groupId: 1, groupType: 1 });
await InvitationModel.createIndex({ email: 1, groupId: 1 }, { unique: true });
await InvitationModel.createIndex({ expiredAt: 1 }, { expireAfterSeconds: 0 });
