import ApiController from "../../apiController.js";
import RollCallService from "../../../services/internal/rollCall.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE, ROLL_CALL_STATUS } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IReqRollCall } from "../../../interfaces/api/request.js";
import type { IRollCallEntry, IRollCallSession } from "../../../interfaces/database/rollCall.js";

export const createRollCallSession = ApiController.callbackFactory<
    { classId: string },
    { body: IReqRollCall.CreateSession },
    IRollCallSession
>({
    action: "create-roll-call-sessions",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: (req) => req.params.classId,
    callback: async (req, res, next) => {
        try {
            const { date } = req.body;
            const { classId } = req.params;
            const requestorId = req.ctx.profileId;
            if (!requestorId)
                throw new ServiceResponseError("AcademicService", "createRollCallSession", "Requestor not found");

            const session = await RollCallService.createRollCallSession(classId, requestorId, date);
            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: session,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const removeRollCallSession = ApiController.callbackFactory<{ sessionId: string }, {}, IRollCallSession>({
    action: "remove-roll-call-session",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) =>
        await RollCallService.getSessionById(req.params.sessionId).then((session) => {
            if (!session) throw new NotFoundError("Roll-call session not found");
            return `${session.classId}`;
        }),
    callback: async (req, res, next) => {
        try {
            const { sessionId } = req.params;
            const requestorId = req.ctx.profileId;
            if (!requestorId)
                throw new ServiceResponseError("AcademicService", "createRollCallSession", "Requestor not found");

            const session = await RollCallService.removeRollCallSession(sessionId, requestorId);
            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: session,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const insertRollCallEntries = ApiController.callbackFactory<
    { sessionId: string },
    { body: IReqRollCall.InsertEntry | IReqRollCall.InsertEntry[] },
    IRollCallEntry[]
>({
    action: "insert-roll-call-entries",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) =>
        await RollCallService.getSessionById(req.params.sessionId).then((session) => {
            if (!session) throw new NotFoundError("Roll-call session not found");
            return `${session.classId}`;
        }),
    callback: async (req, res, next) => {
        try {
            const { sessionId } = req.params;
            const { body } = req;

            const data = Array.isArray(body) ? body : [body];

            const entries = await RollCallService.insertRollCallEntries(sessionId, data);
            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: entries,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const updateRollCallEntry = ApiController.callbackFactory<
    { entryId: string },
    { body: IReqRollCall.UpdateEntry },
    IRollCallEntry
>({
    action: "update-roll-call-entry",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) =>
        await RollCallService.getEntryById(req.params.entryId).then((session) => {
            if (!session) throw new NotFoundError("Roll-call entry not found");
            return `${session.classId}`;
        }),
    callback: async (req, res, next) => {
        try {
            const { entryId } = req.params;
            const { body } = req;

            const entry = await RollCallService.updateRollCallEntry(entryId, body);
            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: entry,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const deleteRollCallEntry = ApiController.callbackFactory<{ entryId: string }, {}, IRollCallEntry>({
    action: "delete-roll-call-entry",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) =>
        await RollCallService.getEntryById(req.params.entryId).then((session) => {
            if (!session) throw new NotFoundError("Roll-call entry not found");
            return `${session.classId}`;
        }),
    callback: async (req, res, next) => {
        try {
            const { entryId } = req.params;

            const entry = await RollCallService.deleteRollCallEntry(entryId);
            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: entry,
            });
        } catch (err) {
            next(err);
        }
    },
});
