import ClassService from "./class.js";
import SchoolService from "./school.js";
import ImgbbService from "../external/imgbb.js";
import { ZodObjectId, ObjectId, z } from "mongooat";
import { isIdsExist } from "../../utils/isIdExist.js";
import { ProfileModel } from "../../database/models/profile.js";
import AccessControlService from "../external/accessControl.js";
import { removeUndefinedKeys } from "../../utils/removeUndefinedKeys.js";
import { GROUP_TYPE, PROFILE_ROLE, RELATIONSHIP } from "../../constants.js";

import NotFoundError from "../../errors/NotFoundError.js";
import BadRequestError from "../../errors/BadRequestError.js";

import type { ClientSession } from "mongodb";
import type { IReqProfile } from "../../interfaces/api/request.js";
import type { IProfile } from "../../interfaces/database/profile.js";

export default class ProfileService {
    private static readonly profileRelationships: Record<PROFILE_ROLE, Partial<Record<PROFILE_ROLE, RELATIONSHIP>>> = {
        [PROFILE_ROLE.EXECUTIVE]: {
            [PROFILE_ROLE.TEACHER]: RELATIONSHIP.SUPERVISES_TEACHERS,
            [PROFILE_ROLE.STUDENT]: RELATIONSHIP.TEACHES,
            [PROFILE_ROLE.PARENT]: RELATIONSHIP.SUPERVISES_PARENTS,
        },
        [PROFILE_ROLE.TEACHER]: {
            [PROFILE_ROLE.STUDENT]: RELATIONSHIP.TEACHES,
            [PROFILE_ROLE.PARENT]: RELATIONSHIP.SUPERVISES_PARENTS,
        },
        [PROFILE_ROLE.STUDENT]: {
            [PROFILE_ROLE.PARENT]: RELATIONSHIP.GUARDED_BY,
        },
        [PROFILE_ROLE.PARENT]: {
            [PROFILE_ROLE.STUDENT]: RELATIONSHIP.PARENT_OF,
        },
    };

    public static async isProfileExists(id: ObjectId, options?: { session?: ClientSession }): Promise<boolean>;
    public static async isProfileExists(ids: ObjectId[], options?: { session?: ClientSession }): Promise<boolean>;
    public static async isProfileExists(
        ids: ObjectId | ObjectId[],
        options?: { session?: ClientSession }
    ): Promise<boolean> {
        return isIdsExist(ProfileModel, Array.isArray(ids) ? ids : [ids], options);
    }

    public static getRelationshipByRoles(roleA: PROFILE_ROLE, roleB: PROFILE_ROLE): RELATIONSHIP | null {
        return ProfileService.profileRelationships[roleA]?.[roleB] ?? null;
    }

    public static async establishRels(profiles: IProfile[], groupType: GROUP_TYPE, groupId: ObjectId): Promise<void> {
        const profileRoles = profiles.map(({ _id, roles }) => ({
            _id: _id,
            roles: AccessControlService.getRolesFromId(roles),
        }));

        switch (groupType) {
            case GROUP_TYPE.SCHOOL: {
                const profileData = profileRoles.map(({ _id, roles }) => ({
                    entityId: _id,
                    relationship: SchoolService.getRelationshipByRole(
                        AccessControlService.getHighestPriorityRole(roles)
                    ),
                }));
                await SchoolService.establishRels(profileData, groupId);
                break;
            }
            case GROUP_TYPE.CLASS: {
                const profileData = profileRoles.map(({ _id, roles }) => ({
                    entityId: _id,
                    relationship: ClassService.getRelationshipByRole(
                        AccessControlService.getHighestPriorityRole(roles)
                    ),
                }));
                await ClassService.establishRels(profileData, groupId);
                break;
            }
            default:
                throw new BadRequestError("Invalid groupType");
        }
    }

    public static async unbindRels(profiles: IProfile[], groupType: GROUP_TYPE, groupId: ObjectId): Promise<void> {
        const profileRoles = profiles.map(({ _id, roles }) => ({
            _id: _id,
            roles: AccessControlService.getRolesFromId(roles),
        }));

        switch (groupType) {
            case GROUP_TYPE.SCHOOL: {
                const profileData = profileRoles.map(({ _id, roles }) => ({
                    entityId: _id,
                    relationship: SchoolService.getRelationshipByRole(
                        AccessControlService.getHighestPriorityRole(roles)
                    ),
                }));
                await SchoolService.unbindRels(profileData, groupId);
                break;
            }
            case GROUP_TYPE.CLASS: {
                const profileData = profileRoles.map(({ _id, roles }) => ({
                    entityId: _id,
                    relationship: ClassService.getRelationshipByRole(
                        AccessControlService.getHighestPriorityRole(roles)
                    ),
                }));
                await ClassService.unbindRels(profileData, groupId);
                break;
            }
            default:
                throw new BadRequestError("Invalid groupType");
        }
    }

    // Query
    public static async getByUserGroupIds(
        userId: string | ObjectId,
        groupId: string | ObjectId
    ): Promise<IProfile | null> {
        const result = await ZodObjectId.safeParseAsync(userId);
        if (result.error) throw new NotFoundError("User not found");

        const result2 = await ZodObjectId.safeParseAsync(groupId);
        if (result2.error) throw new NotFoundError("Group not found");

        return ProfileModel.findOne({ userId: result.data, groupId: result2.data });
    }

    public static async getByIds(id: string | ObjectId): Promise<IProfile | null>;
    public static async getByIds(ids: (string | ObjectId)[]): Promise<IProfile[]>;
    public static async getByIds(
        ids: string | ObjectId | (string | ObjectId)[]
    ): Promise<IProfile | null | IProfile[]> {
        if (Array.isArray(ids)) {
            const result = await z.array(ZodObjectId).safeParseAsync(ids);
            if (result.error) throw new NotFoundError("Profile not found");

            return ProfileModel.find({ _id: { $in: result.data } }, { projection: { _displayName: 0 } });
        }

        const result = await ZodObjectId.safeParseAsync(ids);
        if (result.error) throw new NotFoundError("Profile not found");

        return ProfileModel.findById(result.data, { projection: { _displayName: 0 } });
    }

    public static async getByGroup(
        groupType: GROUP_TYPE,
        groupId: string | ObjectId,
        roles?: PROFILE_ROLE[],
        option?: { session?: ClientSession }
    ): Promise<IProfile[]> {
        const result = await ZodObjectId.safeParseAsync(groupId);
        if (result.error) throw new NotFoundError("Group not found");

        groupId = result.data;
        let includeIds: (ObjectId | string)[] = [];
        if (groupType === GROUP_TYPE.CLASS) {
            const _class = await ClassService.getById(result.data);
            if (!_class) throw new NotFoundError("Class not found");

            // Case where group is school class
            if (_class.schoolId) {
                groupId = _class.schoolId;
                groupType = GROUP_TYPE.SCHOOL;
                result.data = _class.schoolId;

                includeIds.push(
                    ...(await AccessControlService.getRelationshipsByTo(_class._id)).map(({ from }) => `${from}`)
                );
            }
        }

        const filter = {
            groupId,
            groupType,
            ...(roles ? { roles: { $in: roles?.map((role) => AccessControlService.roles[role]._id) } } : {}),
        };

        let profiles = await ProfileModel.find(filter, { session: option?.session, projection: { _displayName: 0 } });
        if (includeIds.length > 0) profiles = profiles.filter(({ _id }) => includeIds.includes(`${_id}`));

        return profiles;
    }

    public static async getByUserId(userId: ObjectId, query?: IReqProfile.Query): Promise<IProfile[]> {
        const { roles } = query || {};

        const roleIds = roles?.map((role) => AccessControlService.roles[role]._id);
        const filter = {
            userId,
            ...(roleIds && { roles: { $in: roleIds } }),
        };

        return ProfileModel.find(filter, { projection: { _displayName: 0 } });
    }

    public static async getByProfileUserIds(profileId: ObjectId, userId: ObjectId): Promise<IProfile | null> {
        const profile = await ProfileModel.findOne({ _id: profileId, userId });
        return profile;
    }

    public static async getRelated(id: string | ObjectId, query?: IReqProfile.Query): Promise<IProfile[]> {
        const { roles } = query || {};

        const result = await ZodObjectId.safeParseAsync(id);
        if (!result.success) throw new NotFoundError("Profile not found");

        const defaultRoles = [PROFILE_ROLE.EXECUTIVE, PROFILE_ROLE.PARENT, PROFILE_ROLE.TEACHER, PROFILE_ROLE.STUDENT];
        const queryRoles = roles?.length ? roles : defaultRoles;

        const relationships = queryRoles
            .flatMap((role) =>
                defaultRoles.flatMap((targetRole) => [
                    ProfileService.getRelationshipByRoles(role, targetRole),
                    ProfileService.getRelationshipByRoles(targetRole, role),
                ])
            )
            .filter((relationship): relationship is RELATIONSHIP => relationship !== null);

        const relQuery = { relationships };
        const relatedProfiles = await AccessControlService.getRelationshipsByTo(result.data, relQuery);
        const profileIds = relatedProfiles.map(({ from }) => from);

        return ProfileModel.find({ _id: { $in: profileIds } }, { projection: { _displayName: 0 } });
    }

    // Mutation
    public static async insert(
        data: IReqProfile.Insert[],
        group: { groupId: ObjectId; groupType: GROUP_TYPE },
        options?: { session?: ClientSession }
    ): Promise<IProfile[]> {
        const insertData = data.map((item) => ({
            ...item,
            groupId: group.groupId,
            groupType: group.groupType,
            _displayName: item.displayName,
            roles: item.roles.map((role) => AccessControlService.roles[role]._id),
        }));
        return (await ProfileModel.insertMany(insertData, { session: options?.session })).map(
            ({ _displayName, ...profile }) => profile
        );
    }

    public static async updateById(
        id: string | ObjectId,
        data: IReqProfile.Update,
        options?: { session?: ClientSession; returnDocument?: "after" | "before" }
    ): Promise<IProfile> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Profile not found");

        const updateData = {
            ...data,
            updatedAt: new Date(),
            _displayName: data.displayName ? data.displayName : undefined,
            roles: data.roles?.map((role) => AccessControlService.roles[role]._id),
        };

        const profile = await ProfileModel.findByIdAndUpdate(result.data, removeUndefinedKeys(updateData), {
            session: options?.session,
            returnDocument: options?.returnDocument ?? "after",
            projection: { _displayName: 0 },
        });
        if (!profile) throw new NotFoundError("Profile not found");

        return profile;
    }

    public static async updateAvatar(id: ObjectId | string, image: Buffer): Promise<string> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Profile not found");

        const { url, deleteUrl } = await ImgbbService.uploadImage(image);

        const updateResult = await ProfileModel.updateOne(
            { _id: result.data },
            { avatarUrl: url, updatedAt: new Date() }
        ).catch(async (err) => {
            await fetch(deleteUrl, { method: "GET" });
            throw err;
        });

        if (updateResult.matchedCount === 0) throw new NotFoundError("Profile not found");
        return url;
    }

    public static async addParentStudentRel(parentId: string | ObjectId, studentIds: ObjectId[]): Promise<void> {
        const relData = studentIds
            .map((studentId) => [
                {
                    from: parentId,
                    to: studentId,
                    relationship: RELATIONSHIP.PARENT_OF,
                },
                {
                    from: studentId,
                    to: parentId,
                    relationship: RELATIONSHIP.GUARDED_BY,
                },
            ])
            .flat();

        await AccessControlService.upsertRelationships(relData);
    }

    public static async removeParentStudentRel(parentId: string | ObjectId, studentIds: ObjectId[]): Promise<void> {
        const relData = studentIds
            .map((studentId) => [
                {
                    from: parentId,
                    to: studentId,
                    relationship: RELATIONSHIP.PARENT_OF,
                },
                {
                    from: studentId,
                    to: parentId,
                    relationship: RELATIONSHIP.GUARDED_BY,
                },
            ])
            .flat();

        await AccessControlService.deleteByFromToRelationship(relData);
    }

    public static async deleteById(id: string | ObjectId, options?: { session?: ClientSession }): Promise<IProfile> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Profile not found");

        const profile = await ProfileModel.findByIdAndDelete(result.data, {
            session: options?.session,
            projection: { _displayName: 0 },
        });
        if (!profile) throw new NotFoundError("Profile not found");

        return profile;
    }

    public static async deleteByGroupId(
        groupId: string | ObjectId,
        options?: { session?: ClientSession }
    ): Promise<ObjectId[]> {
        const result = await ZodObjectId.safeParseAsync(groupId);
        if (result.error) throw new NotFoundError("Group not found");

        const ids = await ProfileModel.find({ groupId: result.data }, { session: options?.session }).then((profiles) =>
            profiles.map((p) => p._id)
        );
        if (ids.length > 0) await ProfileModel.deleteMany({ groupId: result.data }, { session: options?.session });

        return ids;
    }
}
