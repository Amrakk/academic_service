import ApiController from "../../apiController.js";
import NewsService from "../../../services/internal/news.js";
import CommentService from "../../../services/internal/comment.js";
import ProfileService from "../../../services/internal/profile.js";
import { timebasedPaginationSchema } from "../../../utils/schemas.js";
import AccessControlService from "../../../services/external/accessControl.js";
import { RESPONSE_CODE, RESPONSE_MESSAGE, DEFAULT_NEWS_POLLING_INTERVAL } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";
import ForbiddenError from "../../../errors/ForbiddenError.js";
import BadRequestError from "../../../errors/BadRequestError.js";

import type { IResComment } from "../../../interfaces/api/response.js";
import type { ITimeBasedPagination } from "../../../interfaces/api/request.js";

export const getByNewsId = ApiController.callbackFactory<
    { newsId: string },
    { query: ITimeBasedPagination },
    IResComment[]
>({
    action: "view-comment",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        try {
            const [requestor, news] = await Promise.all([
                ProfileService.getByIds(req.ctx.profileId ?? ""),
                NewsService.getById(req.params.newsId),
            ]);
            if (!requestor) throw new NotFoundError("Profile not found");
            else if (!news) throw new NotFoundError("News not found");

            const paginationResult = await timebasedPaginationSchema.safeParseAsync({
                from: req.query?.from,
                limit: req.query?.limit,
            });
            if (paginationResult.error) throw new BadRequestError("Invalid query", { error: paginationResult.error });

            const targetRoles = AccessControlService.getRolesFromId(news.targetRoles);
            const requestorRoles = AccessControlService.getRolesFromId(requestor.roles);

            if (!AccessControlService.isAllowedToViewNews(requestorRoles, targetRoles))
                throw new ForbiddenError("Comment not accessible to the requestor");

            const comment = await CommentService.getByNewsId(news._id, paginationResult.data);
            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: comment,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const getLatestComments = ApiController.callbackFactory<{ newsId: string }, {}, IResComment[]>({
    action: "view-comment",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        try {
            const [requestor, news] = await Promise.all([
                ProfileService.getByIds(req.ctx.profileId ?? ""),
                NewsService.getById(req.params.newsId),
            ]);
            if (!requestor) throw new NotFoundError("Profile not found");
            else if (!news) throw new NotFoundError("News not found");

            const targetRoles = AccessControlService.getRolesFromId(news.targetRoles);
            const requestorRoles = AccessControlService.getRolesFromId(requestor.roles);

            if (!AccessControlService.isAllowedToViewNews(requestorRoles, targetRoles))
                throw new ForbiddenError("Comment not accessible to the requestor");

            const query = { from: new Date(), limit: 30 };

            setTimeout(async () => {
                const comment = await CommentService.getByNewsId(news._id, query, true);
                return res.status(200).json({
                    code: RESPONSE_CODE.SUCCESS,
                    message: RESPONSE_MESSAGE.SUCCESS,
                    data: comment,
                });
            }, DEFAULT_NEWS_POLLING_INTERVAL);
        } catch (err) {
            next(err);
        }
    },
});
