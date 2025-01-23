import { z, ZodObjectId } from "mongooat";
import { removeUndefinedKeys } from "../../utils/removeUndefinedKeys.js";
import { RollCallEntryModel, RollCallSessionModel } from "../../database/models/rollCall.js";

import NotFoundError from "../../errors/NotFoundError.js";
import BadRequestError from "../../errors/BadRequestError.js";

import type { ObjectId } from "mongooat";
import type { IReqRollCall } from "../../interfaces/api/request.js";
import type { IRollCallEntry, IRollCallSession } from "../../interfaces/database/rollCall.js";

export const dateRangeSchema = z
    .object({
        startDate: z
            .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
            .default(() => new Date())
            .transform((val) => {
                val.setHours(0, 0, 0, 0);
                return val;
            }),
        endDate: z
            .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
            .default(() => new Date())
            .transform((val) => {
                val.setHours(23, 59, 59, 999);
                return val;
            }),
    })
    .default({});

export default class RollCallService {
    // Query
    public static async getRollCallSessions(
        classId: string | ObjectId,
        dateRange?: { startDate?: Date; endDate?: Date }
    ): Promise<IRollCallSession[]> {
        const [classIdResult, dateRangeResult] = await Promise.all([
            ZodObjectId.safeParseAsync(classId),
            dateRangeSchema.safeParseAsync(dateRange),
        ]);

        if (classIdResult.error) throw new NotFoundError("Class not found");
        if (dateRangeResult.error)
            throw new BadRequestError("Invalid date range", { error: dateRangeResult.error.errors });

        const filter = {
            classId: classIdResult.data,
            createdAt: {
                $gte: dateRangeResult.data.startDate,
                $lte: dateRangeResult.data.endDate,
            },
        };

        return RollCallSessionModel.find(filter);
    }

    public static async getRollCallEntriesBySessionId(sessionId: string | ObjectId): Promise<IRollCallEntry[]> {
        const result = await ZodObjectId.safeParseAsync(sessionId);
        if (result.error) throw new NotFoundError("Roll-call session not found");

        return RollCallEntryModel.find({ sessionId: result.data });
    }

    public static async getSessionById(id: string | ObjectId): Promise<IRollCallSession | null> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Roll-call session not found");

        return RollCallSessionModel.findById(result.data);
    }

    public static async getEntryById(id: string | ObjectId): Promise<IRollCallEntry | null> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Roll-call entry not found");

        return RollCallEntryModel.findById(result.data);
    }

    // Mutation
    public static async createRollCallSession(
        classId: string | ObjectId,
        createdBy: string | ObjectId,
        date?: Date
    ): Promise<IRollCallSession> {
        const classIdResult = await ZodObjectId.safeParseAsync(classId);
        if (classIdResult.error) throw new NotFoundError("Class not found");

        const createdByResult = await ZodObjectId.safeParseAsync(createdBy);
        if (createdByResult.error) throw new NotFoundError("User not found");

        return RollCallSessionModel.insertOne({
            date,
            classId: classIdResult.data,
            createdBy: createdByResult.data,
        });
    }

    public static async removeRollCallSession(
        sessionId: string | ObjectId,
        requestorId: string | ObjectId
    ): Promise<IRollCallSession> {
        const sessionIdResult = await ZodObjectId.safeParseAsync(sessionId);
        if (sessionIdResult.error) throw new NotFoundError("Roll-call session not found");

        const requestorIdResult = await ZodObjectId.safeParseAsync(requestorId);
        if (requestorIdResult.error) throw new NotFoundError("Invalid requestorId");

        const session = await RollCallSessionModel.findOneAndDelete({
            _id: sessionIdResult.data,
            createdBy: requestorIdResult.data,
        });
        if (!session) throw new NotFoundError("Roll-call session not found or you don't have permission to delete it");

        await RollCallEntryModel.deleteMany({ sessionId: sessionIdResult.data });

        return session;
    }

    public static async insertRollCallEntries(
        sessionId: string | ObjectId,
        data: IReqRollCall.InsertEntry[]
    ): Promise<IRollCallEntry[]> {
        const session = await this.getSessionById(sessionId);
        if (!session) throw new NotFoundError("Roll-call session not found");

        const insertData = data.map((entry) => ({
            ...entry,
            sessionId: session._id,
            classId: session.classId,
        }));
        return RollCallEntryModel.insertMany(insertData);
    }

    public static async updateRollCallEntry(
        id: string | ObjectId,
        data: IReqRollCall.UpdateEntry
    ): Promise<IRollCallEntry> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Roll-call entry not found");

        const entry = await RollCallEntryModel.findByIdAndUpdate(result.data, removeUndefinedKeys(data), {
            returnDocument: "after",
        });
        if (!entry) throw new NotFoundError("Roll-call entry not found");

        return entry;
    }

    public static async deleteRollCallEntry(id: string | ObjectId): Promise<IRollCallEntry> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Roll-call entry not found");

        const entry = await RollCallEntryModel.findByIdAndDelete(result.data);
        if (!entry) throw new NotFoundError("Roll-call entry not found");

        return entry;
    }
}
