import mongooat from "../../../database/db.js";
import ApiController from "../../apiController.js";
import NewsService from "../../../services/internal/news.js";
import ImgbbService from "../../../services/external/imgbb.js";
import CommentService from "../../../services/internal/comment.js";
import ProfileService from "../../../services/internal/profile.js";
import AccessControlService from "../../../services/external/accessControl.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import ConflictError from "../../../errors/ConflictError.js";
import ForbiddenError from "../../../errors/ForbiddenError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { INews } from "../../../interfaces/database/news.js";
import type { IReqNews } from "../../../interfaces/api/request.js";
import type { IResNews } from "../../../interfaces/api/response.js";

export const insert = ApiController.callbackFactory<
    { groupId: string },
    { body: IReqNews.Insert; query: {} },
    IResNews
>({
    action: "add-news",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: (req) => req.params.groupId,
    callback: async (req, res, next) => {
        let deleteUrl;
        try {
            const { body, file } = req;
            const { groupId } = req.params;
            const { _id, displayName, avatarUrl, roles } = req.ctx.profile!;

            const creatorRoles = AccessControlService.getRolesFromId(roles);

            if (file && body.imageUrl) throw new ConflictError("Cannot upload image and use imageUrl at the same time");
            if (body.targetRoles && !AccessControlService.isAllowedToAssignRoles(creatorRoles, body.targetRoles))
                throw new ForbiddenError("Cannot assign roles higher than your own");

            if (file) {
                const uploadResult = await ImgbbService.uploadImage(file.buffer);
                body.imageUrl = uploadResult.url;
                deleteUrl = uploadResult.deleteUrl;
            }

            body.targetRoles = body.targetRoles
                ? body.targetRoles.concat(AccessControlService.getHighestPriorityRole(creatorRoles))
                : [];

            const { creatorId, ...rest } = await NewsService.insert(_id, groupId, body);

            return res.status(201).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: { ...rest, creator: { _id, displayName, avatarUrl } },
            });
        } catch (err) {
            if (deleteUrl) await fetch(deleteUrl, { method: "GET" }).catch((e) => {});
            next(err);
        }
    },
});

export const updateById = ApiController.callbackFactory<
    { groupId: string; id: string },
    { body: IReqNews.Update },
    IResNews
>({
    action: "update-news",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: (req) => req.params.groupId,
    callback: async (req, res, next) => {
        let deleteUrl;
        const session = mongooat.getBase().startSession();
        try {
            const { body, file } = req;
            const { id, groupId } = req.params;
            const { _id, displayName, avatarUrl, roles } = req.ctx.profile!;
            const requestorRoles = AccessControlService.getRolesFromId(roles);

            if (file && body.imageUrl) throw new ConflictError("Cannot upload image and use imageUrl at the same time");
            if (body.targetRoles && !AccessControlService.isAllowedToAssignRoles(requestorRoles, body.targetRoles))
                throw new ForbiddenError("Cannot assign roles higher than your own");

            if (file) {
                const uploadResult = await ImgbbService.uploadImage(file.buffer);
                body.imageUrl = uploadResult.url;
                deleteUrl = uploadResult.deleteUrl;
            }

            let news: IResNews | undefined = undefined;
            await session.withTransaction(async () => {
                const { creatorId, ...updatedNews } = await NewsService.updateById(id, body, { session });

                if (`${creatorId}` !== `${_id}`) throw new ForbiddenError("Cannot update news created by others");
                if (`${updatedNews.groupId}` !== groupId)
                    throw new ConflictError("News's groupId does not match the request.");

                news = { ...updatedNews, creator: { _id, displayName, avatarUrl } };
            });
            if (!news)
                throw new ServiceResponseError("AcademicService", "News: updateById", "Failed to update news", {
                    body,
                });

            return res.status(200).json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: news });
        } catch (err) {
            if (deleteUrl) await fetch(deleteUrl, { method: "GET" }).catch((e) => {});
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const deleteById = ApiController.callbackFactory<{ groupId: string; id: string }, {}, INews>({
    action: "delete-news",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: (req) => req.params.groupId,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { id, groupId } = req.params;

            let news: INews | undefined = undefined;
            await session.withTransaction(async () => {
                const [deletedNews] = await Promise.all([
                    NewsService.deleteById(id, { session }),
                    CommentService.deleteByNewsId([id], { session }),
                ]);
                if (`${deletedNews.groupId}` !== groupId)
                    throw new ConflictError("News's groupId does not match the request.");

                const { _id, roles } = req.ctx.profile!;
                news = { ...deletedNews };

                if (`${deletedNews.creatorId}` !== `${_id}`) {
                    const creator = await ProfileService.getByIds(deletedNews.creatorId);
                    if (!creator) return;

                    const creatorRoles = AccessControlService.getRolesFromId(creator.roles);
                    const creatorHighestRole = AccessControlService.getHighestPriorityRole(creatorRoles);

                    if ([PROFILE_ROLE.PARENT, PROFILE_ROLE.STUDENT].includes(creatorHighestRole))
                        throw new ForbiddenError("Cannot delete news created by others");

                    const requestorRoles = AccessControlService.getRolesFromId(roles);
                    const requestorHighestRole = AccessControlService.getHighestPriorityRole(requestorRoles);

                    if (AccessControlService.compare(requestorHighestRole, creatorHighestRole) <= 0)
                        throw new ForbiddenError("Cannot delete news created by others");
                }
            });
            if (!news)
                throw new ServiceResponseError("AcademicService", "News: deleteById", "Failed to delete news", {
                    id,
                });

            return res.status(200).json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: news });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});
