import { z, ZodObjectId } from "mongooat";
import { USER_ROLE } from "../constants.js";

import ForbiddenError from "../errors/ForbiddenError.js";

import type { Request, Response, NextFunction } from "express";

const schema = z.object({
    user: z.object({
        _id: ZodObjectId,
        name: z.string(),
        role: z.preprocess((val) => parseInt(`${val}`), z.nativeEnum(USER_ROLE)),
    }),
    profileId: ZodObjectId.optional(),
});

export async function requestHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const {
            "x-error": error,
            "x-user-id": userId,
            "x-user-name": name,
            "x-user-role": userRole,
            "x-profile-id": profileId,
        } = req.headers;
        if (error) throw new ForbiddenError();

        const result = await schema.safeParseAsync({
            user: { _id: userId, role: userRole, name: decodeURIComponent(`${name}`) },
            profileId,
        });
        if (result.error) throw new ForbiddenError();

        req.ctx = result.data;
        return next();
    } catch (err) {
        next(err);
    }
}
