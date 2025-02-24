import type { ObjectId } from "mongooat";
import type { PROFILE_ROLE, USER_ROLE } from "./constants.js";
import type { IProfile } from "./interfaces/database/profile.js";

declare global {
    namespace Express {
        interface Request {
            ctx: {
                user: { _id: ObjectId; role: USER_ROLE; name: string };
                profileId?: ObjectId;
                profile?: IProfile;
                newsTargetRoles?: PROFILE_ROLE[];
            };
        }
    }
}
