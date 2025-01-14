import { ValidateError, z } from "mongooat";
import ApiController from "../../apiController.js";
import ProfileService from "../../../services/internal/profile.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";

import type { IReqProfile } from "../../../interfaces/api/request.js";
import type { IProfile } from "../../../interfaces/database/profile.js";

const querySchema = z
    .object({
        roles: z.preprocess((val) => (val ? [val].flat() : val), z.array(z.nativeEnum(PROFILE_ROLE)).optional()),
    })
    .optional();

export const getByUserId = ApiController.callbackFactory<{}, { query: IReqProfile.GetByUserId }, IProfile[]>({
    action: "view-profiles",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        try {
            const { query } = req;
            const { _id } = req.ctx.user;

            const result = await querySchema.safeParseAsync(query);
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

            const profile = await ProfileService.getById(id);
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
