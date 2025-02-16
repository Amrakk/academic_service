import { ObjectId } from "mongooat";
import mongooat from "../../../database/db.js";
import ApiController from "../../apiController.js";
import NewsService from "../../../services/internal/news.js";
import ClassService from "../../../services/internal/class.js";
import PartyService from "../../../services/internal/party.js";
import SchoolService from "../../../services/internal/school.js";
import SubjectService from "../../../services/internal/subject.js";
import ProfileService from "../../../services/internal/profile.js";
import RollCallService from "../../../services/internal/rollCall.js";
import InvitationService from "../../../services/internal/invitation.js";
import AccessControlService from "../../../services/external/accessControl.js";
import { GROUP_TYPE, PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import { ValidateError } from "mongooat";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IReqSchool } from "../../../interfaces/api/request.js";
import type { ISchool } from "../../../interfaces/database/school.js";

export const insert = ApiController.callbackFactory<{}, { body: IReqSchool.Insert }, ISchool>({
    action: "add-school",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            let insertedSchool: ISchool | undefined;
            const { body } = req;
            const creator = {
                _id: new ObjectId(),
                userId: req.ctx.user._id,
                displayName: "Creator",
                roles: [PROFILE_ROLE.EXECUTIVE],
            };

            await session.withTransaction(async () => {
                const schoolId = new ObjectId();
                const [insertedSchools] = await Promise.all([
                    SchoolService.insert([{ _id: schoolId, ...body }], creator._id, { session }),
                    ProfileService.insert([creator], { groupId: schoolId, groupType: GROUP_TYPE.SCHOOL }, { session }),
                    AccessControlService.upsertRelationships([
                        {
                            from: creator._id,
                            to: schoolId,
                            relationship: RELATIONSHIP.CREATOR,
                        },
                        {
                            from: creator._id,
                            to: schoolId,
                            relationship: RELATIONSHIP.MANAGES,
                        },
                        {
                            from: creator._id,
                            to: creator._id,
                            relationship: RELATIONSHIP.OWN,
                        },
                    ]),
                ]);

                insertedSchool = { ...insertedSchools[0] };
            });

            if (!insertedSchool)
                throw new ServiceResponseError("AcademicService", "School: insert", "Failed to insert school", {
                    body,
                });

            return res.status(201).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: insertedSchool,
            });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const updateById = ApiController.callbackFactory<{ id: string }, { body: IReqSchool.Update }, ISchool>({
    action: "update-school",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.EXECUTIVE, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.id,
    callback: async (req, res, next) => {
        try {
            const { id } = req.params;
            const { body } = req;

            const school = await SchoolService.updateById(id, body);
            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: school });
        } catch (err) {
            next(err);
        }
    },
});

export const updateAvatar = ApiController.callbackFactory<{ id: string }, {}, { url: string }>({
    action: "update-school",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.EXECUTIVE, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.id,
    callback: async (req, res, next) => {
        try {
            const { id } = req.params;
            const imageFile = req.file;

            if (!imageFile)
                throw new ValidateError("Image is required", [
                    { code: "custom", message: "Image is required", path: ["image"] },
                ]);

            const url = await SchoolService.updateAvatar(id, imageFile.buffer);
            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: { url } });
        } catch (err) {
            next(err);
        }
    },
});

export const deleteById = ApiController.callbackFactory<{ id: string }, {}, ISchool>({
    action: "delete-school",
    roleRelationshipPairs: [{ role: PROFILE_ROLE.EXECUTIVE, relationships: [RELATIONSHIP.CREATOR] }],
    toId: async (req) => req.params.id,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            let deletedSchool: ISchool | undefined;
            const { id } = req.params;
            const { profileId } = req.ctx;

            await session.withTransaction(async () => {
                const school = await SchoolService.deleteById(id, profileId!, { session });

                const [profileIds, classIds] = await Promise.all([
                    ProfileService.deleteByGroupId(id, { session }),
                    ClassService.deleteBySchoolId(id, { session }),
                ]);
                await Promise.all([
                    InvitationService.removeCode([id, ...classIds]),
                    PartyService.deleteByClassId(classIds, { session }),
                    SubjectService.deleteByClassId(classIds, { session }),
                    NewsService.deleteByGroupId([id, ...classIds], { session }),
                    RollCallService.deleteRollCallSessionByClassId(classIds, { session }),
                    InvitationService.deleteInvitationsByGroupId([id, ...classIds], { session }),
                ]);

                if (profileIds.length > 0) await AccessControlService.deleteRelationshipByProfileIds(profileIds);

                deletedSchool = { ...school };
            });

            if (!deletedSchool)
                throw new ServiceResponseError("AcademicService", "School: deleteById", "Failed to delete school", {
                    id,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: deletedSchool });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});
