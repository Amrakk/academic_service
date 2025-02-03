import { z, ZodObjectId } from "mongooat";
import { PartyModel } from "../../database/models/party.js";
import { toLowerNonAccentVietnamese } from "../../utils/removeDiacritics.js";

import NotFoundError from "../../errors/NotFoundError.js";
import BadRequestError from "../../errors/BadRequestError.js";

import type { ClientSession, FilterOperators, ObjectId } from "mongodb";
import type { IParty } from "../../interfaces/database/party.js";
import type { IReqParty } from "../../interfaces/api/request.js";

export default class PartyService {
    // Query
    public static async getByClassId(classId: string | ObjectId): Promise<IParty[]> {
        const result = await ZodObjectId.safeParseAsync(classId);
        if (result.error) throw new NotFoundError("Party not found");

        return PartyModel.find({ classId: result.data });
    }

    public static async getById(id: string | ObjectId): Promise<IParty | null> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Party not found");

        return PartyModel.findById(result.data);
    }

    // Mutation
    public static async insert(
        creatorId: ObjectId,
        classId: string | ObjectId,
        data: IReqParty.Insert[],
        options?: { session?: ClientSession }
    ): Promise<IParty[]> {
        const insertData = data.map((party) => ({
            classId,
            ...party,
            createdBy: creatorId,
            _name: toLowerNonAccentVietnamese(party.name),
        }));

        return PartyModel.insertMany(insertData, { session: options?.session });
    }

    public static async updateById(
        id: string | ObjectId,
        data: IReqParty.Update,
        options?: { session?: ClientSession }
    ): Promise<IParty> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Party not found");

        const updateData = {
            ...data,
            ...(data.name ? { _name: toLowerNonAccentVietnamese(data.name) } : {}),
            updatedAt: new Date(),
        };

        const party = await PartyModel.findByIdAndUpdate(result.data, updateData, {
            returnDocument: "after",
            session: options?.session,
        });
        if (!party) throw new NotFoundError("Party not found");

        return party;
    }

    public static async upsertMembers(
        id: string | ObjectId,
        members: (string | ObjectId)[],
        options?: { session?: ClientSession }
    ): Promise<IParty> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Party not found");

        const membersResult = await z.array(ZodObjectId).safeParseAsync(members);
        if (membersResult.error) throw new BadRequestError("Invalid member ids", { error: membersResult.error });

        const party = await PartyModel.collection.findOneAndUpdate(
            { _id: result.data },
            { $addToSet: { memberIds: { $each: membersResult.data } } },
            { session: options?.session, returnDocument: "after" }
        );
        if (!party) throw new NotFoundError("Party not found");

        return party;
    }

    public static async removeMembers(
        id: string | ObjectId,
        members: (string | ObjectId)[],
        options?: { session?: ClientSession }
    ): Promise<IParty> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Party not found");

        const membersResult = await z.array(ZodObjectId).safeParseAsync(members);
        if (membersResult.error) throw new BadRequestError("Invalid member ids", { error: membersResult.error });

        const party = await PartyModel.collection.findOneAndUpdate(
            { _id: result.data },
            { $pull: { memberIds: { $in: membersResult.data } } as FilterOperators<ObjectId[]> },
            { session: options?.session, returnDocument: "after" }
        );
        if (!party) throw new NotFoundError("Party not found");

        return party;
    }

    public static async deleteById(id: string | ObjectId, options?: { session?: ClientSession }): Promise<IParty> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Party not found");

        const party = await PartyModel.findByIdAndDelete(result.data, { session: options?.session });
        if (!party) throw new NotFoundError("Party not found");

        return party;
    }
}
