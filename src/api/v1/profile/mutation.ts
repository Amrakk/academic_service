import mongooat from "../../../database/db.js";
import ApiController from "../../apiController.js";
import { ObjectId, z, ZodObjectId } from "mongooat";
import ClassService from "../../../services/internal/class.js";
import SchoolService from "../../../services/internal/school.js";
import ProfileService from "../../../services/internal/profile.js";
import { groupTypeSchema } from "../../../database/models/profile.js";
import { removeUndefinedKeys } from "../../../utils/removeUndefinedKeys.js";
import AccessControlService from "../../../services/external/accessControl.js";
import { GROUP_TYPE, PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import { ValidateError } from "mongooat";
import NotFoundError from "../../../errors/NotFoundError.js";
import ForbiddenError from "../../../errors/ForbiddenError.js";
import BadRequestError from "../../../errors/BadRequestError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IReqProfile } from "../../../interfaces/api/request.js";
import type { IProfile } from "../../../interfaces/database/profile.js";

const paramSchema = z.object({
    groupType: groupTypeSchema,
    groupId: ZodObjectId,
});

export const insert = ApiController.callbackFactory<
    { groupType: string; groupId: string },
    { body: IReqProfile.Insert | IReqProfile.Insert[] },
    IProfile[]
>({
    action: "add-profile",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.EXECUTIVE, relationships: [RELATIONSHIP.CREATOR] },
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.groupId,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const creator = req.ctx.profile;
            if (!creator)
                throw new ServiceResponseError("Academic Service", "Profile: insert", "Creator is undefined", {
                    creator,
                });

            const { body } = req;
            let data = [];

            if (Array.isArray(body)) data = body;
            else data = [body];

            const result = await paramSchema.safeParseAsync(req.params);
            if (result.error) throw new ValidateError("Invalid groupType or groupId", result.error.errors);

            const { groupType, groupId } = result.data;

            const insertRoles = data.reduce((acc, item) => [...acc, ...item.roles], [] as PROFILE_ROLE[]);
            if (groupType === GROUP_TYPE.CLASS && insertRoles.includes(PROFILE_ROLE.EXECUTIVE))
                throw new BadRequestError("Class group type is not allowed for executive role");

            const insertData = data.map((item) => {
                const roles = item.roles.filter((role, index, self) => self.indexOf(role) === index);
                const creatorRoles = AccessControlService.getRolesFromId(creator.roles);

                if (!AccessControlService.isAllowedToAssignRoles(creatorRoles, roles)) throw new ForbiddenError();
                if (!AccessControlService.isRolesValid(roles))
                    throw new ValidateError("Invalid role", [
                        { code: "custom", message: "Student role cannot assigned with other roles", path: ["roles"] },
                    ]);

                return { ...item, roles };
            });

            let profiles: IProfile[] = [];
            await session.withTransaction(async () => {
                const insertedProfiles = await ProfileService.insert(insertData, result.data, { session });

                const profileRoles = insertedProfiles.map(({ _id, roles }) => ({
                    _id: _id,
                    roles: AccessControlService.getRolesFromId(roles),
                }));
                const profileData = profileRoles.map(({ _id, roles }) => ({
                    entityId: _id,
                    relationship: SchoolService.getRelationshipByRole(
                        AccessControlService.getHighestPriorityRole(roles)
                    ),
                }));

                if (groupType === GROUP_TYPE.SCHOOL) await SchoolService.establishRels(profileData, groupId);
                else if (groupType === GROUP_TYPE.CLASS) await ClassService.establishRels(profileData, groupId);
                else throw new BadRequestError("Invalid groupType");

                profiles = [...insertedProfiles];
            });

            return res.status(201).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: profiles,
            });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const updateById = ApiController.callbackFactory<{ id: string }, { body: IReqProfile.Update }, IProfile>({
    action: "update-profile",
    roleRelationshipPairs: [
        {
            role: PROFILE_ROLE.EXECUTIVE,
            relationships: [RELATIONSHIP.SUPERVISES_TEACHERS],
        },
        {
            role: PROFILE_ROLE.TEACHER,
            relationships: [RELATIONSHIP.OWN, RELATIONSHIP.TEACHES, RELATIONSHIP.SUPERVISES_PARENTS],
        },
    ],
    toId: async (req) => req.params.id,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            let { body } = req;
            const { id } = req.params;
            const requestor = req.ctx.profile;

            if (!requestor)
                throw new ServiceResponseError("Academic Service", "Profile: updateById", "Requestor is undefined", {
                    requestor,
                });

            let newHighestRole: PROFILE_ROLE | undefined;

            if (body.roles && body.roles.length > 0) {
                const requestorRoles = AccessControlService.getRolesFromId(requestor.roles);
                newHighestRole = AccessControlService.getHighestPriorityRole(body.roles);

                const roles = body.roles.filter((role, index, self) => self.indexOf(role) === index);
                if (!AccessControlService.isAllowedToAssignRoles(requestorRoles, roles)) throw new ForbiddenError();
                if (!AccessControlService.isRolesValid(roles))
                    throw new ValidateError("Invalid role", [
                        { code: "custom", message: "Invalid role value", path: ["roles"] },
                    ]);

                body = { ...body, roles };
            }

            let profile: IProfile | undefined;

            await session.withTransaction(async () => {
                const oldProfile = await ProfileService.updateById(id, body, { session, returnDocument: "before" });
                const oldRoles = AccessControlService.getRolesFromId(oldProfile.roles);
                const oldHighestRole = AccessControlService.getHighestPriorityRole(oldRoles);

                if (newHighestRole && newHighestRole !== oldHighestRole) {
                    const profile = {
                        entityId: oldProfile._id,
                        relationship: SchoolService.getRelationshipByRole(oldHighestRole),
                    };

                    switch (oldProfile.groupType) {
                        case GROUP_TYPE.SCHOOL:
                            await SchoolService.unbindRels([profile], oldProfile.groupId);
                            profile.relationship = SchoolService.getRelationshipByRole(newHighestRole);
                            await SchoolService.establishRels([profile], oldProfile.groupId);
                            break;
                        case GROUP_TYPE.CLASS:
                            await ClassService.unbindRels([profile], oldProfile.groupId);
                            profile.relationship = ClassService.getRelationshipByRole(newHighestRole);
                            await ClassService.establishRels([profile], oldProfile.groupId);
                            break;
                        default:
                            throw new BadRequestError("Invalid groupType");
                    }
                }

                profile = removeUndefinedKeys({
                    ...oldProfile,
                    ...body,
                    userId: body.userId ? new ObjectId(body.userId) : undefined,
                });
            });

            if (!profile)
                throw new ServiceResponseError("Academic Service", "Profile: updateById", "Profile is undefined", {
                    id,
                    profile,
                    requestor,
                });
            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: profile });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const updateAvatar = ApiController.callbackFactory<{ id: string }, {}, { url: string }>({
    action: "update-profile",
    roleRelationshipPairs: [
        {
            role: PROFILE_ROLE.EXECUTIVE,
            relationships: [RELATIONSHIP.SUPERVISES_TEACHERS],
        },
        {
            role: PROFILE_ROLE.TEACHER,
            relationships: [RELATIONSHIP.OWN, RELATIONSHIP.TEACHES, RELATIONSHIP.SUPERVISES_PARENTS],
        },
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

            const url = await ProfileService.updateAvatar(id, imageFile.buffer);
            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: { url } });
        } catch (err) {
            next(err);
        }
    },
});

export const deleteById = ApiController.callbackFactory<{ id: string }, {}, IProfile>({
    action: "delete-profile",
    roleRelationshipPairs: [
        {
            role: PROFILE_ROLE.EXECUTIVE,
            relationships: [RELATIONSHIP.SUPERVISES_TEACHERS],
        },
        {
            role: PROFILE_ROLE.TEACHER,
            relationships: [RELATIONSHIP.OWN, RELATIONSHIP.TEACHES, RELATIONSHIP.SUPERVISES_PARENTS],
        },
    ],
    toId: async (req) => req.params.id,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { id } = req.params;
            const requestor = req.ctx.profile;
            if (!requestor)
                throw new ServiceResponseError("Academic Service", "Profile: deleteById", "Requestor is undefined", {
                    requestor,
                });

            const requestorRoles = AccessControlService.getRolesFromId(requestor.roles);

            let profile: IProfile | undefined;
            await session.withTransaction(async () => {
                const target = await ProfileService.deleteById(id, { session });

                const group = await (target.groupType === GROUP_TYPE.SCHOOL
                    ? SchoolService.getById(target.groupId, { session })
                    : ClassService.getById(target.groupId, { session }));

                if (!group) throw new NotFoundError("Group not found");

                if (`${group.creatorId}` === `${target._id}`)
                    throw new ForbiddenError("Cannot delete creator of group");

                const targetRoles = target.roles.map((role) => AccessControlService.getRolesFromId(role));
                if (
                    requestorRoles.includes(PROFILE_ROLE.TEACHER) &&
                    targetRoles.includes(PROFILE_ROLE.TEACHER) &&
                    target.groupType === GROUP_TYPE.SCHOOL
                )
                    throw new ForbiddenError("Teachers are not allowed to delete their own profile in a school group.");

                await AccessControlService.deleteRelationshipByProfileIds([target._id]);
                profile = { ...target };
            });

            if (!profile)
                throw new ServiceResponseError("Academic Service", "Profile: deleteById", "Profile is undefined", {
                    id,
                    profile,
                    requestor,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: profile });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});
