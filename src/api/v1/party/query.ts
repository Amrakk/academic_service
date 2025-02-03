import ApiController from "../../apiController.js";
import PartyService from "../../../services/internal/party.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";

import type { IParty } from "../../../interfaces/database/party.js";
import ForbiddenError from "../../../errors/ForbiddenError.js";
import ConflictError from "../../../errors/ConflictError.js";

export const getByClassId = ApiController.callbackFactory<{ classId: string }, {}, IParty[]>({
    action: "view-parties",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: (req) => req.params.classId,
    callback: async (req, res, next) => {
        try {
            const { classId } = req.params;

            const parties = await PartyService.getByClassId(classId);
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

export const getById = ApiController.callbackFactory<{ classId: string; id: string }, {}, IParty>({
    action: "view-party",
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

            const party = await PartyService.getById(id);
            if (!party) throw new NotFoundError("Party not found");
            if (`${party.classId}` !== classId) throw new ConflictError("Party's classId does not match the request");

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: party,
            });
        } catch (err) {
            next(err);
        }
    },
});
