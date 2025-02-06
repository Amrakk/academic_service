import ApiController from "../../apiController.js";
import GradeService from "../../../services/internal/grade.js";
import SubjectService from "../../../services/internal/subject.js";
import { GET_GRADE_ID_TYPE, PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";

import type { IGrade } from "../../../interfaces/database/grade.js";

export const getByStudentId = ApiController.callbackFactory<{ studentId: string }, {}, IGrade[]>({
    action: "view-grade",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.TEACHES] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.OWN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.PARENT_OF] },
    ],
    toId: (req) => req.params.studentId,
    callback: async (req, res, next) => {
        try {
            const { studentId } = req.params;

            const grades = await GradeService.getById(studentId, GET_GRADE_ID_TYPE.STUDENT);

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: grades,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const getBySubjectId = ApiController.callbackFactory<{ subjectId: string }, {}, IGrade[]>({
    action: "view-grade",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: async (req) =>
        await SubjectService.getById(req.params.subjectId).then((subject) => {
            if (!subject) throw new NotFoundError("Subject not found");
            return `${subject.classId}`;
        }),
    callback: async (req, res, next) => {
        try {
            const { subjectId } = req.params;

            const grades = await GradeService.getById(subjectId, GET_GRADE_ID_TYPE.SUBJECT);

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: grades,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const getByGradeTypeId = ApiController.callbackFactory<{ subjectId: string; gradeTypeId: string }, {}, IGrade[]>(
    {
        action: "view-grade",
        roleRelationshipPairs: [
            { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
            { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
            { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.HAS_CHILD_IN] },
        ],
        toId: async (req) =>
            await SubjectService.getById(req.params.subjectId).then((subject) => {
                if (!subject) throw new NotFoundError("Subject not found");
                if (!subject.gradeTypes.find((type) => `${type._id}` === `${req.params.gradeTypeId}`))
                    throw new NotFoundError("Grade type not found in the subject");

                return `${subject.classId}`;
            }),
        callback: async (req, res, next) => {
            try {
                const { gradeTypeId } = req.params;

                const grades = await GradeService.getById(gradeTypeId, GET_GRADE_ID_TYPE.GRADE_TYPE);

                return res.status(200).json({
                    code: RESPONSE_CODE.SUCCESS,
                    message: RESPONSE_MESSAGE.SUCCESS,
                    data: grades,
                });
            } catch (err) {
                next(err);
            }
        },
    }
);

export const getByStudentAndSubjectId = ApiController.callbackFactory<
    { studentId: string; subjectId: string },
    {},
    IGrade[]
>({
    action: "view-grade",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.TEACHES] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.OWN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.PARENT_OF] },
    ],
    toId: async (req) => req.params.studentId,
    callback: async (req, res, next) => {
        try {
            const { studentId, subjectId } = req.params;

            const grades = await GradeService.getByStudentAndSubjectId(studentId, subjectId);

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: grades,
            });
        } catch (err) {
            next(err);
        }
    },
});
