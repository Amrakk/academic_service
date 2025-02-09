import ApiController from "../../apiController.js";
import NewsService from "../../../services/internal/news.js";
import ProfileService from "../../../services/internal/profile.js";
import AccessControlService from "../../../services/external/accessControl.js";
import { roleSchema, timebasedPaginationSchema } from "../../../utils/schemas.js";
import {
    PROFILE_ROLE,
    RELATIONSHIP,
    RESPONSE_CODE,
    RESPONSE_MESSAGE,
    DEFAULT_NEWS_POLLING_INTERVAL,
} from "../../../constants.js";

import ConflictError from "../../../errors/ConflictError.js";
import NotFoundError from "../../../errors/NotFoundError.js";
import ForbiddenError from "../../../errors/ForbiddenError.js";
import BadRequestError from "../../../errors/BadRequestError.js";

import type { IResNews } from "../../../interfaces/api/response.js";
import type { IReqNews } from "../../../interfaces/api/request.js";

export const getById = ApiController.callbackFactory<{ groupId: string; id: string }, {}, IResNews>({
    action: "view-news",
    roleRelationshipPairs: [
        {
            role: PROFILE_ROLE.TEACHER,
            relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES, RELATIONSHIP.EMPLOYED_AT],
        },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.STUDIES_AT, RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.ASSOCIATED_WITH, RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: (req) => req.params.groupId,
    callback: async (req, res, next) => {
        try {
            const { id } = req.params;
            const { roles: requestorRoles } = req.ctx.profile!;

            const isExecutive = AccessControlService.getRolesFromId(requestorRoles).includes(PROFILE_ROLE.EXECUTIVE);

            const news = await NewsService.getById(id);
            if (!news) throw new NotFoundError("News not found");
            else if (`${news.groupId}` !== `${req.params.groupId}`)
                throw new ConflictError("News not found in the group");
            else if (
                !isExecutive &&
                news.targetRoles &&
                !news.targetRoles.some((role) => requestorRoles.includes(role))
            )
                throw new ForbiddenError("News not accessible to the requestor");

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: news,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const getMyNews = ApiController.callbackFactory<{}, { query: IReqNews.Query }, IResNews[]>({
    action: "view-news",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        try {
            const profile = await ProfileService.getByIds(req.ctx.profileId ?? "");
            if (!profile) throw new NotFoundError("Profile not found");

            const { _id, displayName, avatarUrl } = profile;

            const news = await NewsService.getByProfileId(_id, req.query);
            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: news.map(({ creatorId, ...news }) => ({
                    ...news,
                    creator: { _id, displayName, avatarUrl },
                })),
            });
        } catch (err) {
            next(err);
        }
    },
});

export const getGroupNews = ApiController.callbackFactory<{}, { query: IReqNews.Query }, IResNews[]>({
    action: "view-news",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        try {
            const requestor = await ProfileService.getByIds(req.ctx.profileId ?? "");
            if (!requestor) throw new NotFoundError("Profile not found");

            const [paginationResult, targetRolesResult] = await Promise.all([
                timebasedPaginationSchema.safeParseAsync({
                    from: req.query?.from,
                    limit: req.query?.limit,
                }),
                roleSchema.safeParseAsync(req.query?.targetRoles),
            ]);
            if (paginationResult.error || targetRolesResult.error)
                throw new BadRequestError("Invalid query", {
                    error: paginationResult.error ?? targetRolesResult.error,
                });

            const targetRoles = targetRolesResult.data?.map((role) => AccessControlService.roles[role]._id);
            const requestorRoles = AccessControlService.getRolesFromId(requestor.roles);

            if (targetRoles && !AccessControlService.isAllowedToViewNews(requestorRoles, targetRolesResult.data ?? []))
                throw new ForbiddenError("News not accessible to the requestor");

            const relatedGroups = await AccessControlService.getRelationshipsByFrom(requestor._id, {
                relationships: [
                    RELATIONSHIP.CREATOR,
                    RELATIONSHIP.MANAGES,
                    RELATIONSHIP.EMPLOYED_AT,
                    RELATIONSHIP.STUDIES_AT,
                    RELATIONSHIP.ENROLLED_IN,
                    RELATIONSHIP.HAS_CHILD_IN,
                    RELATIONSHIP.ASSOCIATED_WITH,
                ],
            });
            const relatedGroupIds = relatedGroups
                .map(({ to }) => to)
                .filter((id, index, arr) => arr.findIndex((i) => `${i}` === `${id}`) === index);

            const query = { ...paginationResult.data, targetRoles };
            const news = await NewsService.getByGroupIds(relatedGroupIds, requestorRoles, query);
            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: news,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const getLatestNews = ApiController.callbackFactory<{}, { query: IReqNews.Filter }, IResNews[]>({
    action: "view-news",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        try {
            const requestor = await ProfileService.getByIds(req.ctx.profileId ?? "");
            if (!requestor) throw new NotFoundError("Profile not found");

            const targetRolesResult = await roleSchema.safeParseAsync(req.query?.targetRoles);

            if (targetRolesResult.error)
                throw new BadRequestError("Invalid query", {
                    error: targetRolesResult.error,
                });

            const targetRoles = targetRolesResult.data?.map((role) => AccessControlService.roles[role]._id);
            const requestorRoles = AccessControlService.getRolesFromId(requestor.roles);

            if (targetRoles && !AccessControlService.isAllowedToViewNews(requestorRoles, targetRolesResult.data ?? []))
                throw new ForbiddenError("News not accessible to the requestor");

            const query = { targetRoles, from: new Date(), limit: 15 };
            setTimeout(async () => {
                const relatedGroups = await AccessControlService.getRelationshipsByFrom(requestor._id, {
                    relationships: [
                        RELATIONSHIP.CREATOR,
                        RELATIONSHIP.MANAGES,
                        RELATIONSHIP.EMPLOYED_AT,
                        RELATIONSHIP.STUDIES_AT,
                        RELATIONSHIP.ENROLLED_IN,
                        RELATIONSHIP.HAS_CHILD_IN,
                        RELATIONSHIP.ASSOCIATED_WITH,
                    ],
                });

                const relatedGroupIds = relatedGroups
                    .map(({ to }) => to)
                    .filter((id, index, arr) => arr.findIndex((i) => `${i}` === `${id}`) === index);

                const news = await NewsService.getByGroupIds(relatedGroupIds, requestorRoles, query, true);

                return res.status(200).json({
                    code: RESPONSE_CODE.SUCCESS,
                    message: RESPONSE_MESSAGE.SUCCESS,
                    data: news,
                });
            }, DEFAULT_NEWS_POLLING_INTERVAL);
        } catch (err) {
            next(err);
        }
    },
});
