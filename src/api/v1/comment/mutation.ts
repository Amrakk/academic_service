import mongooat from "../../../database/db.js";
import ApiController from "../../apiController.js";
import NewsService from "../../../services/internal/news.js";
import CommentService from "../../../services/internal/comment.js";
import ProfileService from "../../../services/internal/profile.js";
import AccessControlService from "../../../services/external/accessControl.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";
import ConflictError from "../../../errors/ConflictError.js";
import ForbiddenError from "../../../errors/ForbiddenError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IReqComment } from "../../../interfaces/api/request.js";
import type { IResComment } from "../../../interfaces/api/response.js";
import type { IComment } from "../../../interfaces/database/comment.js";

export const insert = ApiController.callbackFactory<{ newsId: string }, { body: IReqComment.Upsert }, IResComment>({
    action: "add-comment",
    roleRelationshipPairs: [
        {
            role: PROFILE_ROLE.TEACHER,
            relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES, RELATIONSHIP.EMPLOYED_AT],
        },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.STUDIES_AT, RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.ASSOCIATED_WITH, RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: async (req) =>
        NewsService.getById(req.params.newsId).then((news) => {
            if (!news) throw new NotFoundError("News not found");
            req.ctx.newsTargetRoles = AccessControlService.getRolesFromId(news.targetRoles);

            return `${news.groupId}`;
        }),
    callback: async (req, res, next) => {
        try {
            const { body } = req;
            const { newsId } = req.params;
            const { newsTargetRoles } = req.ctx;
            const { _id, displayName, avatarUrl, roles } = req.ctx.profile!;

            if (!newsTargetRoles)
                throw new ServiceResponseError("AcademicService", "Comment: insert", "News target roles not found", {
                    body,
                    newsId,
                });

            const creatorRoles = AccessControlService.getRolesFromId(roles);
            if (!AccessControlService.isAllowedToViewNews(creatorRoles, newsTargetRoles))
                throw new ForbiddenError("Comment for this news is not accessible to the requestor");

            const { creatorId, ...rest } = await CommentService.insert(_id, newsId, body.content);
            return res.status(201).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: { ...rest, creator: { _id, displayName, avatarUrl } },
            });
        } catch (err) {
            next(err);
        }
    },
});

export const updateById = ApiController.callbackFactory<
    { newsId: string; id: string },
    { body: IReqComment.Upsert },
    IResComment
>({
    action: "update-comment",
    roleRelationshipPairs: [
        {
            role: PROFILE_ROLE.TEACHER,
            relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES, RELATIONSHIP.EMPLOYED_AT],
        },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.STUDIES_AT, RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.ASSOCIATED_WITH, RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: async (req) =>
        NewsService.getById(req.params.newsId).then((news) => {
            if (!news) throw new NotFoundError("News not found");
            req.ctx.newsTargetRoles = AccessControlService.getRolesFromId(news.targetRoles);

            return `${news.groupId}`;
        }),
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { body } = req;
            const { id, newsId } = req.params;
            const { newsTargetRoles } = req.ctx;
            const { _id, displayName, avatarUrl, roles } = req.ctx.profile!;

            if (!newsTargetRoles)
                throw new ServiceResponseError("AcademicService", "Comment: insert", "News target roles not found", {
                    body,
                    newsId,
                });

            const creatorRoles = AccessControlService.getRolesFromId(roles);
            if (!AccessControlService.isAllowedToViewNews(creatorRoles, newsTargetRoles))
                throw new ForbiddenError("Comment for this news is not accessible to the requestor");

            let comment: IResComment | undefined = undefined;
            await session.withTransaction(async () => {
                const { creatorId, ...updatedComment } = await CommentService.updateById(id, body.content, { session });

                if (`${creatorId}` !== `${_id}`) throw new ForbiddenError("Cannot update comment created by others");
                if (`${updatedComment.newsId}` !== newsId)
                    throw new ConflictError("Comment's newsId does not match the request.");

                comment = { ...updatedComment, creator: { _id, displayName, avatarUrl } };
            });
            if (!comment)
                throw new ServiceResponseError("AcademicService", "Comment: updateById", "Failed to update comment", {
                    body,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: comment });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const deleteById = ApiController.callbackFactory<{ newsId: string; id: string }, {}, IComment>({
    action: "delete-comment",
    roleRelationshipPairs: [
        {
            role: PROFILE_ROLE.TEACHER,
            relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES, RELATIONSHIP.EMPLOYED_AT],
        },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.STUDIES_AT, RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.ASSOCIATED_WITH, RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: async (req) =>
        NewsService.getById(req.params.newsId).then((news) => {
            if (!news) throw new NotFoundError("News not found");
            req.ctx.newsTargetRoles = AccessControlService.getRolesFromId(news.targetRoles);

            return `${news.groupId}`;
        }),
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { id, newsId } = req.params;
            const { newsTargetRoles } = req.ctx;
            const { _id, roles } = req.ctx.profile!;

            if (!newsTargetRoles)
                throw new ServiceResponseError("AcademicService", "Comment: insert", "News target roles not found", {
                    newsId,
                });

            const creatorRoles = AccessControlService.getRolesFromId(roles);
            if (!AccessControlService.isAllowedToViewNews(creatorRoles, newsTargetRoles))
                throw new ForbiddenError("Comment for this news is not accessible to the requestor");

            let comment: IComment | undefined = undefined;
            await session.withTransaction(async () => {
                const deletedComment = await CommentService.deleteById(id, { session });
                if (`${deletedComment.newsId}` !== newsId)
                    throw new ConflictError("Comment's newsId does not match the request.");

                comment = { ...deletedComment };

                if (`${deletedComment.creatorId}` !== `${_id}`) {
                    const creator = await ProfileService.getByIds(deletedComment.creatorId);
                    if (!creator) return;

                    const creatorRoles = AccessControlService.getRolesFromId(creator.roles);
                    const creatorHighestRole = AccessControlService.getHighestPriorityRole(creatorRoles);

                    if ([PROFILE_ROLE.PARENT, PROFILE_ROLE.STUDENT].includes(creatorHighestRole))
                        throw new ForbiddenError("Cannot delete comment created by others");

                    const requestorRoles = AccessControlService.getRolesFromId(roles);
                    const requestorHighestRole = AccessControlService.getHighestPriorityRole(requestorRoles);

                    if (AccessControlService.compare(requestorHighestRole, creatorHighestRole) <= 0)
                        throw new ForbiddenError("Cannot delete comment created by others");
                }
            });
            if (!comment)
                throw new ServiceResponseError("AcademicService", "Comment: deleteById", "Failed to delete comment", {
                    id,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: comment });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});
