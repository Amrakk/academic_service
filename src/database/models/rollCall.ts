import { z, ZodObjectId } from "mongooat";
import { ROLL_CALL_STATUS } from "../../constants.js";
import mongooat from "../db.js";

export const rollCallStatusSchema = z.nativeEnum(ROLL_CALL_STATUS);

export const rollCallEntrySchema = z.object({
    sessionId: ZodObjectId,
    profileId: ZodObjectId,
    classId: ZodObjectId,
    status: rollCallStatusSchema.default(ROLL_CALL_STATUS.ABSENT),
    remarks: z.string().optional(),
    updatedAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
    createdAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const rollCallSessionSchema = z.object({
    classId: ZodObjectId,
    createdBy: ZodObjectId,
    date: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date())
        .transform((val) => {
            val.setHours(0, 0, 0, 0);
            return val;
        }),
    updatedAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
    createdAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const RollCallEntryModel = mongooat.Model("RollCallEntry", rollCallEntrySchema);
export const RollCallSessionModel = mongooat.Model("RollCallSession", rollCallSessionSchema);

await RollCallEntryModel.dropIndexes();
await RollCallEntryModel.createIndex({ status: 1 });
await RollCallEntryModel.createIndex({ sessionId: 1 });
await RollCallEntryModel.createIndex({ profileId: 1 });
await RollCallEntryModel.createIndex({ sessionId: 1, profileId: 1 }, { unique: true });

await RollCallSessionModel.dropIndexes();
await RollCallSessionModel.createIndex({ date: 1 });
await RollCallSessionModel.createIndex({ classId: 1 });
await RollCallSessionModel.createIndex({ classId: 1, date: 1 }, { unique: true });
