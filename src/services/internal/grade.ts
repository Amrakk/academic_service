import { z, ZodObjectId } from "mongooat";
import { GET_GRADE_ID_TYPE } from "../../constants.js";
import { GradeModel } from "../../database/models/grade.js";

import NotFoundError from "../../errors/NotFoundError.js";
import BadRequestError from "../../errors/BadRequestError.js";

import type { ClientSession, ObjectId } from "mongodb";
import type { IGrade } from "../../interfaces/database/grade.js";
import type { IReqGrade } from "../../interfaces/api/request.js";

export default class GradeService {
    // Query
    public static async getById(id: string | ObjectId): Promise<IGrade | null>;
    public static async getById(id: string | ObjectId, idType: GET_GRADE_ID_TYPE): Promise<IGrade[]>;
    public static async getById(id: string | ObjectId, idType?: GET_GRADE_ID_TYPE): Promise<IGrade | null | IGrade[]> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error)
            throw idType
                ? new BadRequestError(`Invalid ${idType}`, { error: result.error.errors })
                : new NotFoundError("Grade not found");

        return idType ? GradeModel.find({ [idType]: result.data }) : GradeModel.findById(result.data);
    }

    public static async getByStudentAndSubjectId(
        studentId: string | ObjectId,
        subjectId: string | ObjectId
    ): Promise<IGrade[]> {
        const [student, subject] = await Promise.all([
            ZodObjectId.safeParseAsync(studentId),
            ZodObjectId.safeParseAsync(subjectId),
        ]);

        if (student.error || subject.error)
            throw new BadRequestError("Invalid student or subject", {
                error: student.error?.errors || subject.error?.errors,
            });

        return GradeModel.find({ studentId: student.data, subjectId: subject.data });
    }
    // Mutation
    public static async insert(
        subjectId: string | ObjectId,
        data: IReqGrade.Insert[],
        options?: { session?: ClientSession }
    ): Promise<IGrade[]> {
        const insertData = data.map((grade) => ({ ...grade, subjectId }));
        return GradeModel.insertMany(insertData, { session: options?.session });
    }

    public static async updateById(
        id: string | ObjectId,
        data: IReqGrade.Update,
        options?: { session?: ClientSession }
    ): Promise<IGrade> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new BadRequestError("Invalid gradeId", { error: result.error.errors });

        const grade = await GradeModel.findByIdAndUpdate(result.data, data, {
            session: options?.session,
            returnDocument: "after",
        });
        if (!grade) throw new NotFoundError("Grade not found");

        return grade;
    }

    public static async deleteById(id: string | ObjectId, options?: { session?: ClientSession }): Promise<IGrade> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new BadRequestError("Invalid gradeId", { error: result.error.errors });

        const grade = await GradeModel.findByIdAndDelete(result.data, { session: options?.session });
        if (!grade) throw new NotFoundError("Grade not found");

        return grade;
    }

    public static async deleteByGradeType(
        gradeTypeId: (string | ObjectId)[],
        options?: { session?: ClientSession }
    ): Promise<void> {
        const result = await z.array(ZodObjectId).safeParseAsync(gradeTypeId);
        if (result.error) throw new BadRequestError("Invalid gradeTypeId", { error: result.error.errors });

        await GradeModel.deleteMany({ gradeTypeId: { $in: result.data } }, { session: options?.session });
    }

    public static async deleteBySubjectId(
        subjectId: (string | ObjectId)[],
        options?: { session?: ClientSession }
    ): Promise<void> {
        const result = await z.array(ZodObjectId).safeParseAsync(subjectId);
        if (result.error) throw new BadRequestError("Invalid subjectId", { error: result.error.errors });

        await GradeModel.deleteMany({ subjectId: { $in: result.data } }, { session: options?.session });
    }

    public static async deleteByStudentId(
        studentId: (string | ObjectId)[],
        options?: { session?: ClientSession }
    ): Promise<void> {
        const result = await z.array(ZodObjectId).safeParseAsync(studentId);
        if (result.error) throw new BadRequestError("Invalid studentId", { error: result.error.errors });

        await GradeModel.deleteMany({ studentId: { $in: result.data } }, { session: options?.session });
    }
}
