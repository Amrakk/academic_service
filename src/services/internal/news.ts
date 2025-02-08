import { z, ZodObjectId } from "mongooat";
import { roleSchema, timebasedPaginationSchema } from "../../utils/schemas.js";
import { NewsModel } from "../../database/models/news.js";
import AccessControlService from "../external/accessControl.js";

import NotFoundError from "../../errors/NotFoundError.js";
import BadRequestError from "../../errors/BadRequestError.js";

import type { ClientSession, ObjectId } from "mongodb";
import type { INews } from "../../interfaces/database/news.js";
import type { IReqNews, ITimeBasedPagination } from "../../interfaces/api/request.js";
import type { IResNews } from "../../interfaces/api/response.js";
import { PROFILE_ROLE } from "../../constants.js";
import ForbiddenError from "../../errors/ForbiddenError.js";

export default class NewsService {
    // Query
    public static async getById(id: string | ObjectId): Promise<IResNews | null> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("News not found");

        const pipeline = [
            { $match: { _id: result.data } },
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

        const news = (await NewsModel.collection.aggregate(pipeline).toArray()) as IResNews[];
        return news[0] ?? null;
    }

    public static async getByProfileId(profileId: string | ObjectId, query?: IReqNews.Query): Promise<INews[]> {
        const [profileIdResult, targetRolesResult, paginationResult] = await Promise.all([
            ZodObjectId.safeParseAsync(profileId),
            roleSchema.safeParseAsync(query?.targetRoles),
            timebasedPaginationSchema.safeParseAsync({ from: query?.from, limit: query?.limit }),
        ]);
        if (profileIdResult.error) throw new NotFoundError("Profile not found");
        else if (targetRolesResult.error || paginationResult.error)
            throw new BadRequestError("Invalid query", { error: targetRolesResult.error ?? paginationResult.error });

        const targetRoles = targetRolesResult.data?.map((role) => AccessControlService.roles[role]._id);
        const { from, limit } = paginationResult.data;

        const filter = {
            ...(from ? { createdAt: { $lt: from } } : {}),
            ...(targetRoles ? { targetRoles: { $in: targetRoles } } : {}),
        };

        return NewsModel.collection.find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
    }

    public static async getByGroupIds(
        groupIds: ObjectId[],
        requestorRoles: PROFILE_ROLE[],
        query?: Omit<IReqNews.Query, "targetRoles"> & { targetRoles?: ObjectId[] },
        isGetLatest: boolean = false
    ): Promise<IResNews[]> {
        const { from, limit, targetRoles } = query ?? {};

        const hasTargetRolesQuery = Boolean(targetRoles?.length);
        const allowedRoles = hasTargetRolesQuery
            ? targetRoles
            : AccessControlService.getLowerRoles(AccessControlService.getHighestPriorityRole(requestorRoles)).map(
                  ({ _id }) => _id
              );

        const filter: Record<string, any> = {
            groupId: { $in: groupIds },
            $or: [{ targetRoles: { $in: allowedRoles } }],
            ...(from ? { createdAt: { [isGetLatest ? "$gte" : "$lt"]: from } } : {}),
        };

        if (!hasTargetRolesQuery) filter.$or.push({ targetRoles: { $size: 0 } });

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

        return NewsModel.collection
            .aggregate(pipeline)
            .sort({ createdAt: -1 })
            .limit(limit || 10)
            .toArray() as Promise<IResNews[]>;
    }

    // Mutation
    public static async insert(creatorId: ObjectId, groupId: string | ObjectId, data: IReqNews.Insert): Promise<INews> {
        const [groupIdResult, targetRolesResult] = await Promise.all([
            ZodObjectId.safeParseAsync(groupId),
            roleSchema.safeParseAsync(data.targetRoles),
        ]);

        if (groupIdResult.error) throw new NotFoundError("Group not found");
        else if (targetRolesResult.error)
            throw new BadRequestError("Invalid targetRoles", { error: targetRolesResult.error });

        const insertData = {
            ...data,
            creatorId,
            groupId: groupIdResult.data,
            targetRoles: targetRolesResult.data?.map((role) => AccessControlService.roles[role]._id),
        };

        return NewsModel.insertOne(insertData);
    }

    public static async updateById(
        id: string | ObjectId,
        data: IReqNews.Update,
        options?: { session?: ClientSession }
    ): Promise<INews> {
        const [idResult, targetRolesResult] = await Promise.all([
            ZodObjectId.safeParseAsync(id),
            roleSchema.safeParseAsync(data.targetRoles),
        ]);

        if (idResult.error) throw new NotFoundError("Group not found");
        else if (targetRolesResult.error)
            throw new BadRequestError("Invalid targetRoles", { error: targetRolesResult.error });

        const updateData = {
            ...data,
            targetRoles: targetRolesResult.data?.map((role) => AccessControlService.roles[role]._id),
            updatedAt: new Date(),
        };

        const news = await NewsModel.findByIdAndUpdate(idResult.data, updateData, {
            session: options?.session,
            returnDocument: "after",
        });
        if (!news) throw new NotFoundError("News not found");

        return news;
    }

    public static async deleteById(id: string | ObjectId, options?: { session?: ClientSession }): Promise<INews> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("News not found");

        const news = await NewsModel.findByIdAndDelete(result.data, { session: options?.session });
        if (!news) throw new NotFoundError("News not found");

        return news;
    }
}
