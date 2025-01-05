import ApiController from "../../apiController.js";
import ProfileService from "../../../services/internal/profile.js";
import { RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";

import type { IProfile } from "../../../interfaces/database/profile.js";

export const getById = ApiController.callbackFactory<{ id: string }, {}, IProfile>(async (req, res, next) => {
    try {
        const { id } = req.params;

        const profile = await ProfileService.getById(id);
        if (!profile) throw new NotFoundError("Profile not found");

        return res.status(200).json({
            code: RESPONSE_CODE.SUCCESS,
            message: RESPONSE_MESSAGE.SUCCESS,
            data: profile,
        });
    } catch (err) {
        next(err);
    }
});
