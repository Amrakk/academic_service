import { z, ZodObjectId } from "mongooat";
import { CommentModel } from "../../database/models/comment.js";

import NotFoundError from "../../errors/NotFoundError.js";
import BadRequestError from "../../errors/BadRequestError.js";

import type { ClientSession, ObjectId } from "mongodb";
import type { IResComment } from "../../interfaces/api/response.js";
import type { IComment } from "../../interfaces/database/comment.js";
import type { ITimeBasedPagination } from "../../interfaces/api/request.js";

export default class CommentService {
    // Query
    public static async getByNewsId(
        newsId: ObjectId,
        query?: ITimeBasedPagination,
        isGetLatest: boolean = false
    ): Promise<IResComment[]> {
        const { from, limit } = query || {};

        const filter = {
            newsId,
            ...(from ? { createdAt: { [isGetLatest ? "$gte" : "$lt"]: from } } : {}),
        };

        const pipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: "Profile",
                    localField: "creatorId",
                    foreignField: "_id",
                    as: "temp",
                },
            },
            { $unwind: "$temp" },
            {
                $addFields: {
                    creator: {
                        _id: "$temp._id",
                        displayName: "$temp.displayName",
                        avatarUrl: "$temp.avatarUrl",
                    },
                },
            },
            { $unset: ["temp", "creatorId"] },
        ];

        return CommentModel.collection
            .aggregate(pipeline)
            .sort({ createdAt: -1 })
            .limit(limit || 10)
            .toArray() as Promise<IResComment[]>;
    }

    // Mutation
    public static async insert(creatorId: ObjectId, newsId: string | ObjectId, content: string): Promise<IComment> {
        const newsIdResult = await ZodObjectId.safeParseAsync(newsId);
        if (newsIdResult.error) throw new NotFoundError("News not found");

        const insertData = { content, creatorId, newsId: newsIdResult.data };
        return CommentModel.insertOne(insertData);
    }

    public static async updateById(
        id: string | ObjectId,
        content: string,
        options?: { session?: ClientSession }
    ): Promise<IComment> {
        const idResult = await ZodObjectId.safeParseAsync(id);
        if (idResult.error) throw new NotFoundError("Group not found");

        const updateData = { content, updatedAt: new Date() };
        const comment = await CommentModel.findByIdAndUpdate(idResult.data, updateData, {
            session: options?.session,
            returnDocument: "after",
        });
        if (!comment) throw new NotFoundError("Comment not found");

        return comment;
    }

    public static async deleteById(id: string | ObjectId, options?: { session?: ClientSession }): Promise<IComment>;
    public static async deleteById(id: (string | ObjectId)[], options?: { session?: ClientSession }): Promise<void>;
    public static async deleteById(
        id: string | ObjectId | (string | ObjectId)[],
        options?: { session?: ClientSession }
    ): Promise<IComment | void> {
        if (Array.isArray(id)) {
            const result = await z.array(ZodObjectId).safeParseAsync(id);
            if (result.error) throw new NotFoundError("Comment not found");

            await CommentModel.deleteMany({ _id: { $in: result.data } }, { session: options?.session });
            return;
        }
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Comment not found");

        const comment = await CommentModel.findByIdAndDelete(result.data, { session: options?.session });
        if (!comment) throw new NotFoundError("Comment not found");

        return comment;
    }

    public static async deleteByNewsId(
        newsId: (string | ObjectId)[],
        options?: { session?: ClientSession }
    ): Promise<void> {
        const result = await z.array(ZodObjectId).safeParseAsync(newsId);
        if (result.error) throw new NotFoundError("News not found");

        await CommentModel.deleteMany({ newsId: { $in: result.data } }, { session: options?.session });
    }

    public static async deleteByCreatorId(
        creatorId: (string | ObjectId)[],
        options?: { session?: ClientSession }
    ): Promise<void> {
        const result = await z.array(ZodObjectId).safeParseAsync(creatorId);
        if (result.error) throw new BadRequestError("Creator not found", { error: result.error.errors });

        await CommentModel.deleteMany({ creatorId: { $in: result.data } }, { session: options?.session });
    }
}
