import ImgbbService from "../external/imgbb.js";
import { GROUP_TYPE, PROFILE_ROLE } from "../../constants.js";
import { ZodObjectId, ObjectId } from "mongooat";
import { ProfileModel } from "../../database/models/profile.js";
import AccessControlService from "../external/accessControl.js";
import { removeUndefinedKeys } from "../../utils/removeUndefinedKeys.js";

import NotFoundError from "../../errors/NotFoundError.js";

import type { ClientSession } from "mongodb";
import type { IReqProfile } from "../../interfaces/api/request.js";
import type { IProfile } from "../../interfaces/database/profile.js";

export default class ProfileService {
    // Query
    public static async getById(id: string | ObjectId): Promise<IProfile | null> {
        const result = await ZodObjectId.safeParseAsync(id);
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

        const filter = {
            groupType,
            groupId: result.data,
            ...(roles ? { roles: { $in: roles?.map((role) => AccessControlService.roles[role]._id) } } : {}),
        };

        return ProfileModel.find(filter, { session: option?.session, projection: { _displayName: 0 } });
    }

    public static async getByUserId(userId: ObjectId, query?: IReqProfile.GetByUserId): Promise<IProfile[]> {
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
