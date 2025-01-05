import { ObjectId, ZodObjectId } from "mongooat";
import { ProfileModel } from "../../database/models/profile.js";

import NotFoundError from "../../errors/NotFoundError.js";

import type { IProfile } from "../../interfaces/database/profile.js";

export default class ProfileService {
    public static async getById(id: string | ObjectId): Promise<IProfile | null> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Profile not found");

        return ProfileModel.findById(result.data);
    }
}
