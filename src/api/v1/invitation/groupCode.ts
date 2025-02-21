import mongooat from "../../../database/db.js";
import ApiController from "../../apiController.js";
import { ObjectId, z, ZodObjectId } from "mongooat";
import ClassService from "../../../services/internal/class.js";
import SchoolService from "../../../services/internal/school.js";
import ProfileService from "../../../services/internal/profile.js";
import { groupTypeSchema } from "../../../database/models/profile.js";
import InvitationService from "../../../services/internal/invitation.js";
import AccessControlService from "../../../services/external/accessControl.js";
import {
    GROUP_TYPE,
    PROFILE_ROLE,
    RELATIONSHIP,
    RESPONSE_CODE,
    RESPONSE_MESSAGE,
    DEFAULT_CODE_EXPIRE_TIME,
} from "../../../constants.js";

import ConflictError from "../../../errors/ConflictError.js";
import NotFoundError from "../../../errors/NotFoundError.js";
import ForbiddenError from "../../../errors/ForbiddenError.js";
import BadRequestError from "../../../errors/BadRequestError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IProfile } from "../../../interfaces/database/profile.js";
import type { IReqInvitation } from "../../../interfaces/api/request.js";

const generateGroupCodeSchema = z.object({
    groupId: ZodObjectId,
    groupType: groupTypeSchema,
    newProfileRole: z.nativeEnum(PROFILE_ROLE),
    expireMinutes: z.number().int().positive().default(DEFAULT_CODE_EXPIRE_TIME),
});

export const generateGroupCode = ApiController.callbackFactory<
    {},
    { body: IReqInvitation.GetGroupCode },
    { code: string }
>({
    action: "generate-group-code",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: (req) => `${req.body.groupId}`,
    callback: async (req, res, next) => {
        try {
            const result = await generateGroupCodeSchema.safeParseAsync(req.body);
            if (result.error) throw new BadRequestError("Invalid data", { errors: result.error.errors });

            const { groupId, groupType, newProfileRole } = result.data;

            const requestor = req.ctx.profile;
            if (!requestor)
                throw new ServiceResponseError("AcademicService", "generateGroupCode", "Requestor not found");

            if (
                !AccessControlService.isAllowedToAssignRoles(AccessControlService.getRolesFromId(requestor.roles), [
                    newProfileRole,
                ])
            )
                throw new ForbiddenError("Requestor is not allowed to assign the specified role");

            let schoolId = undefined;
            switch (groupType) {
                case GROUP_TYPE.SCHOOL:
                    const school = await SchoolService.getById(groupId);
                    if (!school) throw new NotFoundError("School not found");

                    break;
                case GROUP_TYPE.CLASS:
                    const _class = await ClassService.getById(groupId);
                    if (!_class) throw new NotFoundError("Class not found");

                    schoolId = _class.schoolId;

                    break;
                default:
                    throw new BadRequestError("Invalid group type");
            }

            const code = await InvitationService.generateInvitationCode({
                groupId,
                groupType,
                newProfileRole,
                schoolId,
                expireMinutes: result.data.expireMinutes,
            });

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: { code },
            });
        } catch (err) {
            next(err);
        }
    },
});

export const removeGroupCode = ApiController.callbackFactory<{ groupId: string }, {}, {}>({
    action: "remove-group-code",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: (req) => req.params.groupId,
    callback: async (req, res, next) => {
        try {
            const { groupId } = req.params;

            await InvitationService.removeCode(groupId);

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const submitCode = ApiController.callbackFactory<{ code: string }, {}, IProfile>({
    action: "submit-code",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { code } = req.params;
            const data = await InvitationService.getInvitationData(code);
            const { schoolId, groupId, groupType, newProfileRole } = data;

            let profile: IProfile | undefined;

            await session.withTransaction(async () => {
                const requestor = req.ctx.user;
                const existedProfile = await ProfileService.getByUserGroupIds(requestor._id, schoolId ?? groupId);

                if (existedProfile) {
                    const updatingRoles = [
                        ...new Set([...AccessControlService.getRolesFromId(existedProfile.roles), newProfileRole]),
                    ];

                    if (!AccessControlService.isRolesValid(updatingRoles))
                        throw new ConflictError("Invalid roles invoked by the code");

                    profile = AccessControlService.getRolesFromId(existedProfile.roles).includes(newProfileRole)
                        ? { ...existedProfile }
                        : {
                              ...(await ProfileService.updateById(
                                  existedProfile._id,
                                  { roles: updatingRoles },
                                  { session }
                              )),
                          };

                    // Establish relationship with school class
                    if (schoolId && groupType === GROUP_TYPE.CLASS) {
                        const existingRelationships = await AccessControlService.getRelationshipByFromTo(
                            profile._id,
                            groupId
                        );

                        if (existingRelationships.length === 0)
                            await ProfileService.establishRels([profile], GROUP_TYPE.CLASS, groupId);
                    }
                } else {
                    const insertData = {
                        _id: new ObjectId(),
                        displayName: requestor.name,
                        roles: [newProfileRole],
                        userId: requestor._id,
                    };

                    const groupInfo = {
                        groupId: schoolId ?? groupId,
                        groupType: schoolId ? GROUP_TYPE.SCHOOL : groupType,
                    };

                    const insertedProfiles = await ProfileService.insert([insertData], groupInfo, { session });
                    profile = { ...insertedProfiles[0] };

                    const promises = schoolId
                        ? [
                              ProfileService.establishRels([profile], GROUP_TYPE.CLASS, groupId),
                              ProfileService.establishRels([profile], GROUP_TYPE.SCHOOL, schoolId),
                          ]
                        : [ProfileService.establishRels([profile], groupType, groupId)];

                    promises.push(
                        AccessControlService.upsertRelationships([
                            { from: profile._id, to: profile._id, relationship: RELATIONSHIP.OWN },
                        ])
                    );

                    await Promise.all(promises);
                }
            });

            if (!profile)
                throw new ServiceResponseError(
                    "AcademicService",
                    "getInvitationData",
                    "Something wrong with profile creation",
                    { code }
                );

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: profile,
            });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});
