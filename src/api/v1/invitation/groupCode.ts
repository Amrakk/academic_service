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

import NotFoundError from "../../../errors/NotFoundError.js";
import ForbiddenError from "../../../errors/ForbiddenError.js";
import BadRequestError from "../../../errors/BadRequestError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IProfile } from "../../../interfaces/database/profile.js";
import type { IReqInvitation } from "../../../interfaces/api/request.js";

const generateGroupCodeSchema = z.object({
    groupId: ZodObjectId,
    groupType: groupTypeSchema,
    newProfileRole: z.preprocess((val) => parseInt(`${val}`), z.nativeEnum(PROFILE_ROLE)),
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
                throw new ServiceResponseError("InvitationService", "generateGroupCode", "Requestor not found");

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
                const insertData = {
                    _id: new ObjectId(),
                    displayName: requestor.name,
                    roles: [newProfileRole],
                    userId: requestor._id,
                };

                // TODO: if user exists, update relationship
                if (schoolId) {
                    const insertedProfiles = await ProfileService.insert(
                        [insertData],
                        { groupId: schoolId, groupType: GROUP_TYPE.SCHOOL },
                        { session }
                    );

                    await Promise.all([
                        ProfileService.establishRels(insertedProfiles, GROUP_TYPE.CLASS, groupId),
                        ProfileService.establishRels(insertedProfiles, GROUP_TYPE.SCHOOL, schoolId),
                    ]);

                    profile = { ...insertedProfiles[0] };
                } else {
                    const insertedProfiles = await ProfileService.insert(
                        [insertData],
                        { groupId, groupType },
                        { session }
                    );

                    await ProfileService.establishRels(insertedProfiles, groupType, groupId);

                    profile = { ...insertedProfiles[0] };
                }
            });

            if (!profile)
                throw new ServiceResponseError(
                    "InvitationService",
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
