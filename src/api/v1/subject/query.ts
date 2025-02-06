import ApiController from "../../apiController.js";
import SubjectService from "../../../services/internal/subject.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";
import ConflictError from "../../../errors/ConflictError.js";

import type { ISubject } from "../../../interfaces/database/subject.js";

export const getByClassId = ApiController.callbackFactory<{ classId: string }, {}, ISubject[]>({
    action: "view-subjects",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: (req) => req.params.classId,
    callback: async (req, res, next) => {
        try {
            const { classId } = req.params;

            const parties = await SubjectService.getByClassId(classId);
            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: parties,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const getById = ApiController.callbackFactory<{ classId: string; id: string }, {}, ISubject>({
    action: "view-subject",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: (req) => req.params.classId,
    callback: async (req, res, next) => {
        try {
            const { id } = req.params;
            const { classId } = req.params;

            const subject = await SubjectService.getById(id);
            if (!subject) throw new NotFoundError("Subject not found");
            if (`${subject.classId}` !== classId)
                throw new ConflictError("Subject's classId does not match the request");

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: subject,
            });
        } catch (err) {
            next(err);
        }
    },
});
