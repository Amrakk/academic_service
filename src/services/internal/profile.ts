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
    public static async isProfileExists(id: ObjectId, options?: { session?: ClientSession }): Promise<boolean>;
    public static async isProfileExists(ids: ObjectId[], options?: { session?: ClientSession }): Promise<boolean>;
    public static async isProfileExists(
        ids: ObjectId | ObjectId[],
        options?: { session?: ClientSession }
    ): Promise<boolean> {
        return isIdsExist(ProfileModel, Array.isArray(ids) ? ids : [ids], options);
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

        let includeIds: (ObjectId | string)[] = [];
        if (groupType === GROUP_TYPE.CLASS) {
            const _class = await ClassService.getById(result.data);
            if (!_class) throw new NotFoundError("Class not found");

            // Case where group is school class
            if (_class.schoolId) {
                groupType = GROUP_TYPE.SCHOOL;
                result.data = _class.schoolId;

                includeIds.push(
                    ...(
                        await AccessControlService.getRelationshipsByTo(_class._id, {
                            relationships: [RELATIONSHIP.MANAGES],
                        })
                    ).map(({ from }) => from)
                );
            }
        }

        const filter = {
            groupType,
            groupId: result.data,
            ...(roles ? { roles: { $in: roles?.map((role) => AccessControlService.roles[role]._id) } } : {}),
        };
        const profiles = await ProfileModel.find(filter, { session: option?.session, projection: { _displayName: 0 } });
        if (includeIds.length > 0) profiles.filter(({ _id }) => includeIds.includes(_id));

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
