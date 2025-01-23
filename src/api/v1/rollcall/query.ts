import ApiController from "../../apiController.js";
import RollCallService from "../../../services/internal/rollCall.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";

import type { IReqRollCall } from "../../../interfaces/api/request.js";
import type { IRollCallEntry, IRollCallSession } from "../../../interfaces/database/rollCall.js";

export const getRollCallSessions = ApiController.callbackFactory<
    { classId: string },
    { query: IReqRollCall.GetSessions },
    IRollCallSession[]
>({
    action: "view-roll-call-sessions",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: (req) => req.params.classId,
    callback: async (req, res, next) => {
        try {
            const { classId } = req.params;
            const dateRange = req.query;

            const sessions = await RollCallService.getRollCallSessions(classId, dateRange);
            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: sessions,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const getRollCallEntriesBySessionId = ApiController.callbackFactory<{ sessionId: string }, {}, IRollCallEntry[]>(
    {
        action: "view-roll-call-entries",
        roleRelationshipPairs: [
            { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
            { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
            { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.HAS_CHILD_IN] },
        ],
        toId: async (req) =>
            await RollCallService.getSessionById(req.params.sessionId).then((session) => {
                if (!session) throw new NotFoundError("Roll-call session not found");
                return `${session.classId}`;
            }),
        callback: async (req, res, next) => {
            try {
                const { sessionId } = req.params;

                const entries = await RollCallService.getRollCallEntriesBySessionId(sessionId);
                return res.status(200).json({
                    code: RESPONSE_CODE.SUCCESS,
                    message: RESPONSE_MESSAGE.SUCCESS,
                    data: entries,
                });
            } catch (err) {
                next(err);
            }
        },
    }
);
