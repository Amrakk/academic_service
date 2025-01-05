import { z, ZodObjectId } from "mongooat";
import { USER_ROLE } from "../constants.js";

import ForbiddenError from "../errors/ForbiddenError.js";

import type { Request, Response, NextFunction } from "express";

const schema = z.object({
    _id: ZodObjectId,
    role: z.preprocess((val) => parseInt(`${val}`), z.nativeEnum(USER_ROLE)),
});

export async function requestHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { "x-user-id": userId, "x-user-role": userRole, "x-error": error } = req.headers;
        if (error) throw new ForbiddenError();

        const result = await schema.safeParseAsync({ _id: userId, role: userRole });
        if (result.error) throw new ForbiddenError();

        req.ctx = { user: result.data };
        return next();
    } catch (err) {
        next(err);
    }
}
