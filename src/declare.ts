import type { ObjectId } from "mongooat";
import type { USER_ROLE } from "./constants.js";

declare global {
    namespace Express {
        interface Request {
            ctx: {
                user: { _id: ObjectId; role: USER_ROLE };
            };
        }
    }
}
