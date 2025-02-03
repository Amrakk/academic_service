import { z, ZodObjectId } from "mongooat";
import mongooat from "../../../database/db.js";
import ApiController from "../../apiController.js";
import PartyService from "../../../services/internal/party.js";
import ProfileService from "../../../services/internal/profile.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import ConflictError from "../../../errors/ConflictError.js";
import BadRequestError from "../../../errors/BadRequestError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IParty } from "../../../interfaces/database/party.js";
import type { IReqParty } from "../../../interfaces/api/request.js";

export const insert = ApiController.callbackFactory<
    { classId: string },
    { body: IReqParty.Insert | IReqParty.Insert[] },
    IParty[]
>({
    action: "add-party",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { body } = req;
            const { classId } = req.params;
            const creatorId = req.ctx.profileId!;

            const data = [body].flat();
            const insertedData: IParty[] = [];

            await session.withTransaction(async () => {
                const memberIds = await z
                    .array(ZodObjectId)
                    .safeParseAsync(data.map((party) => party.memberIds).flat());
                if (memberIds.error) throw new BadRequestError("Invalid memberIds", { error: memberIds.error.errors });

                const [insertedParties, isMembersExisted] = await Promise.all([
                    PartyService.insert(creatorId, classId, data, { session }),
                    ProfileService.isProfileExists(memberIds.data, { session }),
                ]);

                if (!isMembersExisted) throw new BadRequestError("MemberIds do not exist");

                insertedData.push(...insertedParties);
            });

            return res.status(201).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: insertedData,
            });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const updateById = ApiController.callbackFactory<
    { classId: string; id: string },
    { body: IReqParty.Update },
    IParty
>({
    action: "update-party",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { body } = req;
            const { id, classId } = req.params;

            let party: IParty | undefined = undefined;
            await session.withTransaction(async () => {
                const updatedParty = await PartyService.updateById(id, body, { session });
                if (`${updatedParty.classId}` !== classId)
                    throw new ConflictError("Party's classId does not match the request.");

                party = { ...updatedParty };
            });
            if (!party)
                throw new ServiceResponseError("AcademicService", "Party: updateById", "Failed to update party", {
                    body,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: party });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const upsertMembers = ApiController.callbackFactory<
    { classId: string; id: string },
    { body: IReqParty.UpsertRemove },
    IParty
>({
    action: "upsert-party-members",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { body } = req;
            const { id, classId } = req.params;

            let party: IParty | undefined = undefined;
            await session.withTransaction(async () => {
                const memberIds = await z.array(ZodObjectId).safeParseAsync(body.memberIds);
                if (memberIds.error) throw new BadRequestError("Invalid memberIds", { error: memberIds.error.errors });

                const [updatedParty, isMembersExisted] = await Promise.all([
                    PartyService.upsertMembers(id, memberIds.data, { session }),
                    ProfileService.isProfileExists(memberIds.data, { session }),
                ]);

                if (`${updatedParty.classId}` !== classId)
                    throw new ConflictError("Party's classId does not match the request.");
                if (!isMembersExisted) throw new BadRequestError("MemberIds do not exist");

                party = { ...updatedParty };
            });
            if (!party)
                throw new ServiceResponseError("AcademicService", "Party: updateById", "Failed to update party", {
                    body,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: party });
        } catch (err) {
            next(err);
        }
    },
});

export const removeMembers = ApiController.callbackFactory<
    { classId: string; id: string },
    { body: IReqParty.UpsertRemove },
    IParty
>({
    action: "remove-party-members",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { body } = req;
            const { id, classId } = req.params;

            let party: IParty | undefined = undefined;
            await session.withTransaction(async () => {
                const updatedParty = await PartyService.removeMembers(id, body.memberIds);
                if (`${updatedParty.classId}` !== classId)
                    throw new ConflictError("Party's classId does not match the request.");

                party = { ...updatedParty };
            });
            if (!party)
                throw new ServiceResponseError("AcademicService", "Party: removeMembers", "Failed to update party", {
                    body,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: party });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const deleteById = ApiController.callbackFactory<{ classId: string; id: string }, {}, IParty>({
    action: "delete-party",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: async (req) => req.params.classId,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const { id, classId } = req.params;

            let party: IParty | undefined = undefined;
            await session.withTransaction(async () => {
                const deletedParty = await PartyService.deleteById(id);
                if (`${deletedParty.classId}` !== classId)
                    throw new ConflictError("Party's classId does not match the request.");

                party = { ...deletedParty };
            });
            if (!party)
                throw new ServiceResponseError("AcademicService", "Party: deleteById", "Failed to update party", {
                    id,
                });

            return res
                .status(200)
                .json({ code: RESPONSE_CODE.SUCCESS, message: RESPONSE_MESSAGE.SUCCESS, data: party });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});
