import { z, ZodObjectId, ObjectId } from "mongooat";
import { SubjectModel } from "../../database/models/subject.js";

import NotFoundError from "../../errors/NotFoundError.js";
import BadRequestError from "../../errors/BadRequestError.js";

import type { ClientSession } from "mongodb";
import type { IReqSubject } from "../../interfaces/api/request.js";
import type { ISubject } from "../../interfaces/database/subject.js";

export default class SubjectService {
    // Query
    public static async getByClassId(classId: string | ObjectId): Promise<ISubject[]> {
        const result = await ZodObjectId.safeParseAsync(classId);
        if (result.error) throw new BadRequestError("Invalid classId", { error: result.error.errors });

        return SubjectModel.find({ classId: result.data });
    }

    public static async getById(id: string | ObjectId): Promise<ISubject | null> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Subject not found");

        return SubjectModel.findById(result.data);
    }

    // Mutation
    public static async insert(classId: string | ObjectId, data: IReqSubject.Insert): Promise<ISubject> {
        return SubjectModel.insertOne({
            ...data,
            classId,
            _name: data.name,
            gradeTypes: data.gradeTypes.map((type) => ({ name: type })),
        });
    }

    public static async updateById(
        id: string | ObjectId,
        data: IReqSubject.Update,
        options?: { session?: ClientSession }
    ): Promise<ISubject> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Subject not found");

        const updateData = { ...data, ...(data.name ? { _name: data.name } : {}), updatedAt: new Date() };

        const subject = await SubjectModel.findByIdAndUpdate(result.data, updateData, {
            session: options?.session,
            returnDocument: "after",
        });
        if (!subject) throw new NotFoundError("Subject not found");

        return subject;
    }

    public static async addGradeTypes(
        id: string | ObjectId,
        gradeTypes: string[],
        options?: { session?: ClientSession }
    ): Promise<ISubject> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Subject not found");

        const updateData = gradeTypes.map((type) => ({ name: type, _id: new ObjectId() }));

        const subject = await SubjectModel.collection.findOneAndUpdate(
            { _id: result.data },
            { $push: { gradeTypes: { $each: updateData } } },
            { session: options?.session, returnDocument: "after" }
        );
        if (!subject) throw new NotFoundError("Subject not found");

        return subject;
    }

    public static async removeGradeTypes(
        id: string | ObjectId,
        gradeTypes: (string | ObjectId)[],
        options?: { session?: ClientSession }
    ): Promise<ISubject> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Subject not found");

        const gradeTypeResult = await z.array(ZodObjectId).safeParseAsync(gradeTypes);
        if (gradeTypeResult.error)
            throw new BadRequestError("Invalid grade type ids", { error: gradeTypeResult.error });

        const subject = await SubjectModel.collection.findOneAndUpdate(
            { _id: result.data },
            { $pull: { gradeTypes: { _id: { $in: gradeTypeResult.data } } } },
            { session: options?.session, returnDocument: "after" }
        );
        if (!subject) throw new NotFoundError("Subject not found");

        return subject;
    }

    public static async deleteById(id: string | ObjectId, options?: { session?: ClientSession }): Promise<ISubject> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Subject not found");

        const subject = await SubjectModel.findByIdAndDelete(result.data, { session: options?.session });
        if (!subject) throw new NotFoundError("Subject not found");

        return subject;
    }
}
