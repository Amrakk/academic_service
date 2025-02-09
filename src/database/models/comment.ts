import { z } from "zod";
import mongooat from "../db.js";
import { ZodObjectId } from "mongooat";

const commentSchema = z.object({
    newsId: ZodObjectId,
    creatorId: ZodObjectId,
    content: z
        .string()
        .default("")
        .transform((val) => val.trim()),
    updatedAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
    createdAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const CommentModel = mongooat.Model("Comment", commentSchema);

await CommentModel.dropIndexes();
await CommentModel.createIndex({ newsId: 1 });
