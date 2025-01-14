import { ZodObjectId } from "mongooat";
import ImgbbService from "../external/imgbb.js";
import { SchoolModel } from "../../database/models/school.js";
import AccessControlService from "../external/accessControl.js";
import { PROFILE_ROLE, RELATIONSHIP } from "../../constants.js";
import { removeUndefinedKeys } from "../../utils/removeUndefinedKeys.js";

import NotFoundError from "../../errors/NotFoundError.js";
import ServiceResponseError from "../../errors/ServiceResponseError.js";

import type { ObjectId } from "mongooat";
import type { ClientSession } from "mongodb";
import type { IReqSchool } from "../../interfaces/api/request.js";
import type { ISchool } from "../../interfaces/database/school.js";
import type { IReqRelationship } from "../../interfaces/services/external/accessControl.js";

export default class SchoolService {
    private static readonly relationshipConditions = [
        { fromRel: RELATIONSHIP.MANAGES, toRel: RELATIONSHIP.STUDIES_AT, resultRel: RELATIONSHIP.TEACHES },
        {
            fromRel: RELATIONSHIP.MANAGES,
            toRel: RELATIONSHIP.EMPLOYED_AT,
            resultRel: RELATIONSHIP.SUPERVISES_TEACHERS,
        },
        {
            fromRel: RELATIONSHIP.MANAGES,
            toRel: RELATIONSHIP.ASSOCIATED_WITH,
            resultRel: RELATIONSHIP.SUPERVISES_PARENTS,
        },
    ];

    public static getRelationshipByRole(role: PROFILE_ROLE): RELATIONSHIP {
        switch (role) {
            case PROFILE_ROLE.EXECUTIVE:
                return RELATIONSHIP.MANAGES;
            case PROFILE_ROLE.TEACHER:
                return RELATIONSHIP.EMPLOYED_AT;
            case PROFILE_ROLE.STUDENT:
                return RELATIONSHIP.STUDIES_AT;
            case PROFILE_ROLE.PARENT:
                return RELATIONSHIP.ASSOCIATED_WITH;
            default:
                throw new ServiceResponseError("SchoolService", "getRelationshipByRole", "Invalid role", { role });
        }
    }

    public static async establishRels(
        profiles: IReqRelationship.EntityRelationship[],
        schoolId: string | ObjectId
    ): Promise<void> {
        await AccessControlService.bindRelationships({
            initiators: profiles,
            targetId: schoolId,
            conditions: SchoolService.relationshipConditions,
        });
    }

    public static async unbindRels(profiles: IReqRelationship.EntityRelationship[], schoolId: string | ObjectId) {
        await AccessControlService.unbindRelationships({
            terminators: profiles,
            targetId: schoolId,
            conditions: SchoolService.relationshipConditions,
        });
    }

    // Query
    public static async getAll(): Promise<ISchool[]> {
        return SchoolModel.find({}, { projection: { _name: 0 } });
    }

    public static async getById(id: string | ObjectId, options?: { session?: ClientSession }): Promise<ISchool | null> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("School not found");

        return SchoolModel.findById(result.data, { session: options?.session, projection: { _name: 0 } });
    }

    // Mutation
    public static async insert(
        data: IReqSchool.Insert[],
        creatorId: ObjectId,
        options?: { session?: ClientSession }
    ): Promise<ISchool[]> {
        const insertData = data.map((item) => ({ ...item, _name: item.name, creatorId }));
        return (await SchoolModel.insertMany(insertData, { session: options?.session })).map(
            ({ _name, ...school }) => school
        );
    }

    public static async updateById(id: string | ObjectId, data: IReqSchool.Update): Promise<ISchool> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("School not found");

        const updateData = {
            ...data,
            _name: data.name ? data.name : undefined,
            updatedAt: new Date(),
        };

        const school = await SchoolModel.findByIdAndUpdate(result.data, removeUndefinedKeys(updateData), {
            returnDocument: "after",
            projection: { _name: 0 },
        });
        if (!school) throw new NotFoundError("School not found");

        return school;
    }

    public static async updateAvatar(id: ObjectId | string, image: Buffer): Promise<string> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("School not found");

        const { url, deleteUrl } = await ImgbbService.uploadImage(image);

        const updateResult = await SchoolModel.updateOne(
            { _id: result.data },
            { avatarUrl: url, updatedAt: new Date() }
        ).catch(async (err) => {
            await fetch(deleteUrl, { method: "GET" });
            throw err;
        });

        if (updateResult.matchedCount === 0) throw new NotFoundError("School not found");
        return url;
    }

    public static async deleteById(
        id: string | ObjectId,
        creatorId: ObjectId,
        options?: { session?: ClientSession }
    ): Promise<ISchool> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("School not found");

        const school = await SchoolModel.findOneAndDelete(
            { _id: result.data, creatorId },
            { session: options?.session, projection: { _name: 0 } }
        );
        if (!school) throw new NotFoundError("School not found or you don't have permission to delete this school");

        return school;
    }
}
