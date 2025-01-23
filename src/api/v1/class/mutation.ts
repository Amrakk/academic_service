import { ObjectId } from "mongooat";
import mongooat from "../../../database/db.js";
import ApiController from "../../apiController.js";
import ClassService from "../../../services/internal/class.js";
import SchoolService from "../../../services/internal/school.js";
import ProfileService from "../../../services/internal/profile.js";
import AccessControlService from "../../../services/external/accessControl.js";
import { GROUP_TYPE, PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import { ValidateError } from "mongooat";
import BadRequestError from "../../../errors/BadRequestError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IClass } from "../../../interfaces/database/class.js";
import type { IReqClass, IReqProfile } from "../../../interfaces/api/request.js";
import type { IReqRelationship } from "../../../interfaces/services/external/accessControl.js";

export const insert = ApiController.callbackFactory<
    { schoolId?: string },
    { body: IReqClass.Insert | IReqClass.Insert[] },
    IClass[]
>({
    action: "add-class",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { body } = req;
            const { schoolId } = req.params;

            const classes = (Array.isArray(body) ? body : [body]).map((cls) => ({
                ...cls,
                _id: new ObjectId(),
                schoolId,
            }));

            const relationships: IReqRelationship.Upsert[] = [];

            let returnedClasses: IClass[] = [];
            let creator: (IReqProfile.Insert & { _id: ObjectId }) | null = null;

            await session.withTransaction(async () => {
                if (!schoolId) {
                    if (classes.length > 1)
                        throw new BadRequestError("Only one personal class can be created at a time");

                    // Case 1: Personal class
                    const scopeCreator = {
                        _id: new ObjectId(),
                        userId: req.ctx.user._id,
                        displayName: "Creator",
                        roles: [PROFILE_ROLE.TEACHER],
                    };

                    creator = { ...scopeCreator };

                    relationships.push(
                        ...classes.map(({ _id }) => ({
                            from: scopeCreator._id,
                            to: _id,
                            relationship: RELATIONSHIP.MANAGES,
                        }))
                    );
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
                        ...executives.flatMap(({ _id }) =>
                            classes.map((cls) => ({
                                from: _id,
                                to: cls._id,
                                relationship: RELATIONSHIP.MANAGES,
                            }))
                        )
                    );
                }

                const creatorId = creator._id;

                relationships.push(
                    ...classes.map(({ _id }) => ({
                        from: creatorId,
                        to: _id,
                        relationship: RELATIONSHIP.CREATOR,
                    }))
                );

                const [insertedClasses] = await Promise.all([
                    ClassService.insert(classes, creator._id, { session }),
                    schoolId
                        ? undefined
                        : ProfileService.insert(
                              [creator],
                              { groupId: classes[0]._id, groupType: GROUP_TYPE.CLASS },
                              { session }
                          ),
                    AccessControlService.upsertRelationships(relationships),
                ]);

                returnedClasses.push(...insertedClasses);
            });

            return res.status(201).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: returnedClasses,
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
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
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
                throw new ServiceResponseError("AcademicService", "Class: deleteById", "Failed to delete class", {
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

export const bindRelationships = ApiController.callbackFactory<
    { classId: string },
    { body: IReqClass.EditRelationships },
    {}
>({
    action: "bind-relationships-to-school-class",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.EXECUTIVE, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        try {
            const { classId } = req.params;
            const _class = await ClassService.getById(classId);

            if (!_class) throw new BadRequestError("Class not found", { classId });
            if (!_class.schoolId) throw new BadRequestError("Personal class cannot bind relationships", { classId });

            const profiles = await ProfileService.getByIds(req.body.profiles);
            await ProfileService.establishRels(profiles, GROUP_TYPE.CLASS, _class._id);

            return res.status(200).json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS });
        } catch (err) {
            next(err);
        }
    },
});

export const unbindRelationships = ApiController.callbackFactory<
    { classId: string },
    { body: IReqClass.EditRelationships },
    {}
>({
    action: "unbind-relationships-to-school-class",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.EXECUTIVE, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        try {
            const { classId } = req.params;
            const _class = await ClassService.getById(classId);

            if (!_class) throw new BadRequestError("Class not found", { classId });
            if (!_class.schoolId) throw new BadRequestError("Personal class cannot unbind relationships", { classId });

            const profiles = await ProfileService.getByIds(req.body.profiles);
            await ProfileService.unbindRels(profiles, GROUP_TYPE.CLASS, _class._id);

            return res.status(200).json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS });
        } catch (err) {
            next(err);
        }
    },
});
