import mongooat from "../../../database/db.js";
import ApiController from "../../apiController.js";
import GradeService from "../../../services/internal/grade.js";
import SubjectService from "../../../services/internal/subject.js";
import AccessControlService from "../../../services/external/accessControl.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import ConflictError from "../../../errors/ConflictError.js";
import NotFoundError from "../../../errors/NotFoundError.js";
import BadRequestError from "../../../errors/BadRequestError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IGrade } from "../../../interfaces/database/grade.js";
import type { IReqGrade } from "../../../interfaces/api/request.js";

export const insert = ApiController.callbackFactory<
    { subjectId: string },
    { body: IReqGrade.Insert | IReqGrade.Insert[] },
    IGrade[]
>({
    action: "add-grade",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) =>
        await SubjectService.getById(req.params.subjectId).then(async (subject) => {
            if (!subject) throw new NotFoundError("Subject not found");

            const { body } = req;
            const data = [body].flat();

            const inputGradeTypeIds = data
                .map((grade) => `${grade.gradeTypeId}`)
                .filter((id, index, arr) => arr.indexOf(id) === index);

            const gradeTypeIds = subject.gradeTypes.map((type) => `${type._id}`);
            const isGradeTypeValid = inputGradeTypeIds.every((id) => gradeTypeIds.includes(id));
            if (!isGradeTypeValid)
                throw new BadRequestError("Invalid gradeTypeId", { error: "GradeTypeId does not exist" });

            const inputStudentIds = data
                .map((grade) => `${grade.studentId}`)
                .filter((id, index, arr) => arr.indexOf(id) === index);
            const classStudentRels = await AccessControlService.getRelationshipsByTo(subject.classId, {
                relationships: [RELATIONSHIP.ENROLLED_IN],
            });
            const studentIds = classStudentRels.map((rel) => `${rel.from}`);
            const isStudentEnrolled = inputStudentIds.every((id) => studentIds.includes(id));
            if (!isStudentEnrolled)
                throw new BadRequestError("Invalid studentId", { error: "StudentId is not enrolled in the class" });

            return `${subject.classId}`;
        }),
    callback: async (req, res, next) => {
        try {
            const { body } = req;
            const { subjectId } = req.params;

            const data = [body].flat();
            const insertedData = await GradeService.insert(subjectId, data);

            return res.status(201).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: insertedData,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const updateById = ApiController.callbackFactory<
    { subjectId: string; id: string },
    { body: IReqGrade.Update },
    IGrade
>({
    action: "update-grade",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) =>
        await SubjectService.getById(req.params.subjectId).then(async (subject) => {
            if (!subject) throw new NotFoundError("Subject not found");
            return `${subject.classId}`;
        }),
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { body } = req;
            const { id, subjectId } = req.params;

            let grade: IGrade | undefined = undefined;
            await session.withTransaction(async () => {
                const updatedGrade = await GradeService.updateById(id, body, { session });
                if (`${updatedGrade.subjectId}` !== subjectId)
                    throw new ConflictError("Grade's subjectId does not match the request.");

                grade = { ...updatedGrade };
            });
            if (!grade)
                throw new ServiceResponseError("AcademicService", "Grade: updateById", "Failed to update grade", {
                    body,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: grade });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const deleteById = ApiController.callbackFactory<{ subjectId: string; id: string }, {}, IGrade>({
    action: "delete-grade",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) =>
        await SubjectService.getById(req.params.subjectId).then(async (subject) => {
            if (!subject) throw new NotFoundError("Subject not found");
            return `${subject.classId}`;
        }),
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { id, subjectId } = req.params;

            let grade: IGrade | undefined = undefined;
            await session.withTransaction(async () => {
                const deletedGrade = await GradeService.deleteById(id);
                if (`${deletedGrade.subjectId}` !== subjectId)
                    throw new ConflictError("Grade's subjectId does not match the request.");

                grade = { ...deletedGrade };
            });
            if (!grade)
                throw new ServiceResponseError("AcademicService", "Grade: deleteById", "Failed to update grade", {
                    id,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: grade });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});
