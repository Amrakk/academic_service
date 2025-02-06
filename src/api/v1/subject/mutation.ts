import { ObjectId } from "mongooat";
import mongooat from "../../../database/db.js";
import ApiController from "../../apiController.js";
import SubjectService from "../../../services/internal/subject.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import ConflictError from "../../../errors/ConflictError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IReqSubject } from "../../../interfaces/api/request.js";
import type { ISubject } from "../../../interfaces/database/subject.js";

export const insert = ApiController.callbackFactory<{ classId: string }, { body: IReqSubject.Insert }, ISubject>({
    action: "add-subject",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        try {
            const { body } = req;
            const { classId } = req.params;

            const subject = await SubjectService.insert(classId, body);
            return res.status(201).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: subject,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const updateById = ApiController.callbackFactory<
    { classId: string; id: string },
    { body: IReqSubject.Update },
    ISubject
>({
    action: "update-subject",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { body } = req;
            const { id, classId } = req.params;

            let subject: ISubject | undefined = undefined;
            await session.withTransaction(async () => {
                const updatedSubject = await SubjectService.updateById(id, body, { session });

                if (`${updatedSubject.classId}` !== classId)
                    throw new ConflictError("Subject's classId does not match the request.");

                subject = { ...updatedSubject };
            });
            if (!subject)
                throw new ServiceResponseError("AcademicService", "Subject: updateById", "Failed to update subject", {
                    body,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: subject });
        } catch (err) {
            next(err);
        }
    },
});

export const addGradeTypes = ApiController.callbackFactory<
    { classId: string; id: string },
    { body: { gradeTypes: string[] } },
    ISubject
>({
    action: "add-grade-types",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { body } = req;
            const { id, classId } = req.params;

            let subject: ISubject | undefined = undefined;
            await session.withTransaction(async () => {
                const updatedSubject = await SubjectService.addGradeTypes(id, body.gradeTypes, { session });

                if (`${updatedSubject.classId}` !== classId)
                    throw new ConflictError("Subject's classId does not match the request.");

                subject = { ...updatedSubject };
            });
            if (!subject)
                throw new ServiceResponseError(
                    "AcademicService",
                    "Subject: addGradeTypes",
                    "Failed to update subject",
                    {
                        body,
                    }
                );

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: subject });
        } catch (err) {
            next(err);
        }
    },
});

export const removeGradeTypes = ApiController.callbackFactory<
    { classId: string; id: string },
    { body: { gradeTypes: (string | ObjectId)[] } },
    ISubject
>({
    action: "remove-grade-types",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { body } = req;
            const { id, classId } = req.params;

            let subject: ISubject | undefined = undefined;
            await session.withTransaction(async () => {
                // TODO: remove grade content
                const updatedSubject = await SubjectService.removeGradeTypes(id, body.gradeTypes, { session });

                if (`${updatedSubject.classId}` !== classId)
                    throw new ConflictError("Subject's classId does not match the request.");

                subject = { ...updatedSubject };
            });
            if (!subject)
                throw new ServiceResponseError(
                    "AcademicService",
                    "Subject: removeMembers",
                    "Failed to update subject",
                    {
                        body,
                    }
                );

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: subject });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const deleteById = ApiController.callbackFactory<{ classId: string; id: string }, {}, ISubject>({
    action: "delete-subject",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { id, classId } = req.params;

            let subject: ISubject | undefined = undefined;
            await session.withTransaction(async () => {
                // TODO: remove grade/subject content
                const deletedSubject = await SubjectService.deleteById(id, { session });

                if (`${deletedSubject.classId}` !== classId)
                    throw new ConflictError("Subject's classId does not match the request.");

                subject = { ...deletedSubject };
            });
            if (!subject)
                throw new ServiceResponseError("AcademicService", "Subject: deleteById", "Failed to update subject", {
                    id,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: subject });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});
