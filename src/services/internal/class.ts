import { ZodObjectId } from "mongooat";
import ImgbbService from "../external/imgbb.js";
import { ClassModel } from "../../database/models/class.js";
import AccessControlService from "../external/accessControl.js";
import { PROFILE_ROLE, RELATIONSHIP } from "../../constants.js";
import { removeUndefinedKeys } from "../../utils/removeUndefinedKeys.js";

import NotFoundError from "../../errors/NotFoundError.js";
import ServiceResponseError from "../../errors/ServiceResponseError.js";

import type { ObjectId } from "mongooat";
import type { ClientSession } from "mongodb";
import type { IClass } from "../../interfaces/database/class.js";
import type { IReqClass } from "../../interfaces/api/request.js";
import type { IReqRelationship } from "../../interfaces/services/external/accessControl.js";

export default class ClassService {
    private static readonly relationshipConditions = [
        { fromRel: RELATIONSHIP.MANAGES, toRel: RELATIONSHIP.ENROLLED_IN, resultRel: RELATIONSHIP.TEACHES },
        {
            fromRel: RELATIONSHIP.MANAGES,
            toRel: RELATIONSHIP.ASSOCIATED_WITH,
            resultRel: RELATIONSHIP.SUPERVISES_PARENTS,
        },
        {
            fromRel: RELATIONSHIP.MANAGES,
            toRel: RELATIONSHIP.HAS_CHILD_IN,
            resultRel: RELATIONSHIP.SUPERVISES_PARENTS,
        },
    ];

    public static getRelationshipByRole(role: PROFILE_ROLE): RELATIONSHIP {
        switch (role) {
            case PROFILE_ROLE.EXECUTIVE:
                return RELATIONSHIP.MANAGES;
            case PROFILE_ROLE.TEACHER:
                return RELATIONSHIP.MANAGES;
            case PROFILE_ROLE.STUDENT:
                return RELATIONSHIP.ENROLLED_IN;
            case PROFILE_ROLE.PARENT:
                return RELATIONSHIP.HAS_CHILD_IN;
            default:
                throw new ServiceResponseError("ClassService", "getRelationshipByRole", "Invalid role", { role });
        }
    }

    public static async establishRels(
        profiles: IReqRelationship.EntityRelationship[],
        classId: string | ObjectId
    ): Promise<void> {
        await AccessControlService.bindRelationships({
            initiators: profiles,
            targetId: classId,
            conditions: ClassService.relationshipConditions,
        });
    }

    public static async unbindRels(
        profiles: IReqRelationship.EntityRelationship[],
        classId: string | ObjectId,
        isUnbindClass: boolean = false
    ): Promise<void> {
        await AccessControlService.unbindRelationships({
            terminators: profiles,
            targetId: classId,
            isTargetUnbound: isUnbindClass,
            conditions: ClassService.relationshipConditions,
        });
    }

    // Query
    public static async getAll(): Promise<IClass[]> {
        return ClassModel.find({}, { projection: { _name: 0 } });
    }

    public static async getBySchoolId(schoolId: string | ObjectId): Promise<IClass[]> {
        const result = await ZodObjectId.safeParseAsync(schoolId);
        if (result.error) throw new NotFoundError("School not found");

        return ClassModel.find({ schoolId: result.data }, { projection: { _name: 0 } });
    }

    public static async getById(id: string | ObjectId, options?: { session?: ClientSession }): Promise<IClass | null> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Class not found");

        return ClassModel.findById(result.data, { session: options?.session, projection: { _name: 0 } });
    }

    // Mutation
    public static async insert(
        data: IReqClass.Insert[],
        creatorId: ObjectId,
        options?: { session?: ClientSession }
    ): Promise<IClass[]> {
        const insertData = data.map((item) => ({ ...item, _name: item.name, creatorId }));
        return (await ClassModel.insertMany(insertData, { session: options?.session })).map(
            ({ _name, ..._class }) => _class
        );
    }

    public static async updateById(id: string | ObjectId, data: IReqClass.Update): Promise<IClass> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Class not found");

        const updateData = {
            ...data,
            _name: data.name ? data.name : undefined,
            updatedAt: new Date(),
        };

        const _class = await ClassModel.findByIdAndUpdate(result.data, removeUndefinedKeys(updateData), {
            returnDocument: "after",
            projection: { _name: 0 },
        });
        if (!_class) throw new NotFoundError("Class not found");

        return _class;
    }

    public static async updateAvatar(id: ObjectId | string, image: Buffer): Promise<string> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Class not found");

        const { url, deleteUrl } = await ImgbbService.uploadImage(image);

        const updateResult = await ClassModel.updateOne(
            { _id: result.data },
            { avatarUrl: url, updatedAt: new Date() }
        ).catch(async (err) => {
            await fetch(deleteUrl, { method: "GET" });
            throw err;
        });

        if (updateResult.matchedCount === 0) throw new NotFoundError("Class not found");
        return url;
    }

    public static async deleteById(
        id: string | ObjectId,
        creatorId: ObjectId,
        options?: { session?: ClientSession }
    ): Promise<IClass> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Class not found");

        const _class = await ClassModel.findOneAndDelete(
            { _id: result.data, creatorId },
            { session: options?.session, projection: { _name: 0 } }
        );
        if (!_class) throw new NotFoundError("Class not found or you don't have permission to delete this class");

        return _class;
    }

    public static async deleteBySchoolId(
        schoolId: string | ObjectId,
        options?: { session?: ClientSession }
    ): Promise<ObjectId[]> {
        const result = await ZodObjectId.safeParseAsync(schoolId);
        if (result.error) throw new NotFoundError("School not found");

        const ids = await ClassModel.find({ schoolId: result.data }, { session: options?.session }).then((classes) =>
            classes.map((c) => c._id)
        );
        if (ids.length > 0) await ClassModel.deleteMany({ schoolId: result.data }, { session: options?.session });
        return ids;
    }
}
