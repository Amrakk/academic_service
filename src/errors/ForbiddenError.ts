import BaseError from "./BaseError.js";
import { RESPONSE_CODE, RESPONSE_MESSAGE } from "../constants.js";

import type { IResponse } from "../interfaces/api/response.js";

export default class ForbiddenError extends BaseError {
    statusCode = 403;
    response?: string;

    constructor(response?: string) {
        super(RESPONSE_MESSAGE.FORBIDDEN);
        this.response = response;
    }

    public getResponseBody(): IResponse {
        return {
            code: RESPONSE_CODE.FORBIDDEN,
            message: RESPONSE_MESSAGE.FORBIDDEN,
            error: { response: this.response },
        };
    }
}
