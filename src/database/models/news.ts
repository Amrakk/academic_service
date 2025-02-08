import { z } from "zod";
import mongooat from "../db.js";
import { ZodObjectId } from "mongooat";

const newsSchema = z.object({
    content: z.string().transform((val) => val.trim()),
    imageUrl: z.string().optional(),
    targetRoles: z.array(ZodObjectId).default([]),
    creatorId: ZodObjectId,
    groupId: ZodObjectId,
    updatedAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
    createdAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const NewsModel = mongooat.Model("News", newsSchema);

await NewsModel.dropIndexes();
await NewsModel.createIndex({ groupId: 1 });
await NewsModel.createIndex({ creatorId: 1 });
await NewsModel.createIndex({ createdAt: 1 });
