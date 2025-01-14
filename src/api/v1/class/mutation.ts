import { ObjectId } from "mongooat";
import mongooat from "../../../database/db.js";
import ApiController from "../../apiController.js";
import ClassService from "../../../services/internal/class.js";
import ProfileService from "../../../services/internal/profile.js";
import AccessControlService from "../../../services/external/accessControl.js";
import { GROUP_TYPE, PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import { ValidateError } from "mongooat";
import BadRequestError from "../../../errors/BadRequestError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IClass } from "../../../interfaces/database/class.js";
import type { IReqClass, IReqProfile } from "../../../interfaces/api/request.js";
import type { IReqRelationship } from "../../../interfaces/services/external/accessControl.js";
import SchoolService from "../../../services/internal/school.js";

export const insert = ApiController.callbackFactory<{}, { body: IReqClass.Insert }, IClass>({
    action: "add-class",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { name, avatarUrl, schoolId } = req.body;

            const classId = new ObjectId();
            const relationships: IReqRelationship.Upsert[] = [];

            let insertedClass: IClass | undefined;
            let creator: (IReqProfile.Insert & { _id: ObjectId }) | null = null;

            await session.withTransaction(async () => {
                if (!schoolId) {
                    // Case 1: Personal class
                    creator = {
                        _id: new ObjectId(),
                        userId: req.ctx.user._id,
                        displayName: "Creator",
                        roles: [PROFILE_ROLE.TEACHER],
                    };

                    relationships.push({
                        from: creator._id,
                        to: classId,
                        relationship: RELATIONSHIP.MANAGES,
                    });
                } else {
                    // Case 2: School class
                    const [executives, school] = await Promise.all([
                        ProfileService.getByGroup(GROUP_TYPE.SCHOOL, schoolId, [PROFILE_ROLE.EXECUTIVE], { session }),
                        SchoolService.getById(schoolId, { session }),
                    ]);

                    if (!school)
                        throw new BadRequestError("School not found", {
                            body: req.body,
                        });

                    const requestor = executives.find((executive) => `${executive.userId}` === `${req.ctx.user._id}`);
                    if (!requestor)
                        throw new BadRequestError("Only executives of the school can create school classes");

                    creator = { ...requestor, roles: AccessControlService.getRolesFromId(requestor.roles) };

                    relationships.push(
                        ...executives.map(({ _id }) => ({ from: _id, to: classId, relationship: RELATIONSHIP.MANAGES }))
                    );
                }

                relationships.push({
                    from: creator._id,
                    to: classId,
                    relationship: RELATIONSHIP.CREATOR,
                });

                const [insertedClasses] = await Promise.all([
                    ClassService.insert([{ _id: classId, name, avatarUrl, schoolId }], creator._id, { session }),
                    schoolId
                        ? undefined
                        : ProfileService.insert(
                              [creator],
                              { groupId: classId, groupType: GROUP_TYPE.CLASS },
                              { session }
                          ),
                    AccessControlService.upsertRelationships(relationships),
                ]);

                insertedClass = { ...insertedClasses[0] };
            });

            if (!insertedClass)
                throw new ServiceResponseError("Academic Service", "Class: insert", "Failed to insert class", {
                    body: req.body,
                });

            return res.status(201).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: insertedClass,
            });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const updateById = ApiController.callbackFactory<{ id: string }, { body: IReqClass.Update }, IClass>({
    action: "update-class",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.id,
    callback: async (req, res, next) => {
        try {
            const { id } = req.params;
            const { body } = req;

            const _class = await ClassService.updateById(id, body);
            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: _class });
        } catch (err) {
            next(err);
        }
    },
});

export const updateAvatar = ApiController.callbackFactory<{ id: string }, {}, { url: string }>({
    action: "update-class",
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

            const url = await ClassService.updateAvatar(id, imageFile.buffer);
            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: { url } });
        } catch (err) {
            next(err);
        }
    },
});

export const deleteById = ApiController.callbackFactory<{ id: string }, {}, IClass>({
    action: "delete-class",
    roleRelationshipPairs: [{ role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR] }],
    toId: async (req) => req.params.id,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { id } = req.params;
            const { profileId } = req.ctx;

            let deletedClass: IClass | undefined;

            await session.withTransaction(async () => {
                const _class = await ClassService.deleteById(id, profileId!, { session });

                if (!_class.schoolId) {
                    // Case 1: Personal class
                    const profileIds = await ProfileService.deleteByGroupId(id);
                    if (profileIds.length > 0) await AccessControlService.deleteRelationshipByProfileIds(profileIds);
                } else {
                    // Case 2: School class
                    const teachers = await ProfileService.getByGroup(GROUP_TYPE.SCHOOL, id, [PROFILE_ROLE.TEACHER], {
                        session,
                    });

                    const profiles = teachers.map(({ _id }) => ({ entityId: _id, relationship: RELATIONSHIP.MANAGES }));
                    await ClassService.unbindRels(profiles, id, true);
                }

                deletedClass = { ..._class };
            });

            if (!deletedClass)
                throw new ServiceResponseError("Academic Service", "Class: deleteById", "Failed to delete class", {
                    id,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: deletedClass });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});
