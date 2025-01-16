import ApiController from "../../apiController.js";
import { ValidateError, z, ZodObjectId } from "mongooat";
import ProfileService from "../../../services/internal/profile.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IReqProfile } from "../../../interfaces/api/request.js";
import type { IProfile } from "../../../interfaces/database/profile.js";
import { groupTypeSchema } from "../../../database/models/profile.js";

const querySchema = z
    .object({
        roles: z.preprocess((val) => (val ? [val].flat() : val), z.array(z.nativeEnum(PROFILE_ROLE)).optional()),
    })
    .optional();

export const getByUserId = ApiController.callbackFactory<{}, { query: IReqProfile.Query }, IProfile[]>({
    action: "view-profiles",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        try {
            const { _id } = req.ctx.user;

            const result = await querySchema.safeParseAsync(req.query);
            if (result.error) throw new ValidateError("Invalid query", result.error.errors);

            const profile = await ProfileService.getByUserId(_id, result.data);
            if (!profile) throw new NotFoundError("Profile not found");

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: profile,
            });
        } catch (err) {
            next(err);
        }
    },
});

const paramSchema = z.object({
    groupType: groupTypeSchema,
    groupId: ZodObjectId,
});

export const getByGroup = ApiController.callbackFactory<
    { groupType: string; groupId: string },
    { query: IReqProfile.Query },
    IProfile[]
>({
    action: "view-profiles-by-group",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.MANAGES, RELATIONSHIP.CREATOR] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: (req) => req.params.groupId,
    callback: async (req, res, next) => {
        try {
            const requestor = req.ctx.profile;
            if (!requestor)
                throw new ServiceResponseError("Academic Service", "Profile: getByGroup", "Profile not found", {
                    requestor,
                });

            const paramResult = await paramSchema.safeParseAsync(req.params);
            if (paramResult.error) throw new ValidateError("Invalid groupType or groupId", paramResult.error.errors);
            const { groupId, groupType } = paramResult.data;

            const queryResult = await querySchema.safeParseAsync(req.query);
            if (queryResult.error) throw new ValidateError("Invalid query", queryResult.error.errors);

            const profiles = await ProfileService.getByGroup(groupType, groupId, queryResult.data?.roles);
            if (!profiles) throw new NotFoundError("Profile not found");

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: profiles,
            });
        } catch (err) {
            next(err);
        }
    },
});

// TODO: Implement 'extends' query
export const getById = ApiController.callbackFactory<{ id: string }, {}, IProfile>({
    action: "view-profile",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.EXECUTIVE, relationships: [RELATIONSHIP.SUPERVISES_TEACHERS] },
        {
            role: PROFILE_ROLE.TEACHER,
            relationships: [RELATIONSHIP.OWN, RELATIONSHIP.TEACHES, RELATIONSHIP.SUPERVISES_PARENTS],
        },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.OWN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.OWN, RELATIONSHIP.PARENT_OF] },
    ],
    toId: (req) => req.params.id,
    callback: async (req, res, next) => {
        try {
            const { id } = req.params;

            const profile = await ProfileService.getByIds(id);
            if (!profile) throw new NotFoundError("Profile not found");

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: profile,
            });
        } catch (err) {
            next(err);
        }
    },
});
