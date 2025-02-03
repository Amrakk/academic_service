import { z } from "zod";
import mongooat from "../db.js";
import { ZodObjectId } from "mongooat";
import { toLowerNonAccentVietnamese } from "../../utils/removeDiacritics.js";

const partySchema = z.object({
    name: z.string().transform((val) => val.trim()),
    _name: z.string().transform((val) => toLowerNonAccentVietnamese(val.trim())),
    classId: ZodObjectId,
    description: z.string().optional(),
    memberIds: z.array(ZodObjectId),
    createdBy: ZodObjectId,
    updatedAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
    createdAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const PartyModel = mongooat.Model("Party", partySchema);

await PartyModel.dropIndexes();
await PartyModel.createIndex({ classId: 1 });
await PartyModel.createIndex({ _name: 1, classId: 1 }, { unique: true });
