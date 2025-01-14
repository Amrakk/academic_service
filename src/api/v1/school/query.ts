import ApiController from "../../apiController.js";
import SchoolService from "../../../services/internal/school.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";

import type { ISchool } from "../../../interfaces/database/school.js";

export const getById = ApiController.callbackFactory<{ id: string }, {}, ISchool>({
    action: "view-school",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.EXECUTIVE, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.EMPLOYED_AT] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.STUDIES_AT] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.ASSOCIATED_WITH] },
    ],
    toId: (req) => req.params.id,
    callback: async (req, res, next) => {
        try {
            const { id } = req.params;

            const school = await SchoolService.getById(id);
            if (!school) throw new NotFoundError("School not found");

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: school,
            });
        } catch (err) {
            next(err);
        }
    },
});
