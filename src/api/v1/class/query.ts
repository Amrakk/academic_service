import ApiController from "../../apiController.js";
import ClassService from "../../../services/internal/class.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";

import type { IClass } from "../../../interfaces/database/class.js";

export const getBySchoolId = ApiController.callbackFactory<{ schoolId: string }, {}, IClass[]>({
    action: "view-classes",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: (req) => req.params.schoolId,
    callback: async (req, res, next) => {
        try {
            const { schoolId } = req.params;

            const classes = await ClassService.getBySchoolId(schoolId);
            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: classes,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const getById = ApiController.callbackFactory<{ id: string }, {}, IClass>({
    action: "view-class",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.HAS_CHILD_IN] },
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
