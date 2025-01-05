import BaseError from "./BaseError.js";
import { RESPONSE_CODE, RESPONSE_MESSAGE } from "../constants.js";

import type { IResponse } from "../interfaces/api/response.js";

export default class NotFoundError extends BaseError {
    statusCode = 404;

    constructor(message?: string) {
        super(message ?? RESPONSE_MESSAGE.NOT_FOUND);
    }

    public getResponseBody(): IResponse {
        return {
            code: RESPONSE_CODE.NOT_FOUND,
            message: RESPONSE_MESSAGE.NOT_FOUND,
            error: { message: this.message },
        };
    }
}
