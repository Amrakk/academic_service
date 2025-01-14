import ApiController from "../../apiController.js";
import ClassService from "../../../services/internal/class.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";

import type { ISchool } from "../../../interfaces/database/school.js";

export const getById = ApiController.callbackFactory<{ id: string }, {}, ISchool>({
    action: "view-class",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.ASSOCIATED_WITH] },
    ],
    toId: (req) => req.params.id,
    callback: async (req, res, next) => {
        try {
            const { id } = req.params;

            const _class = await ClassService.getById(id);
            if (!_class) throw new NotFoundError("Class not found");

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: _class,
            });
        } catch (err) {
            next(err);
        }
    },
});
