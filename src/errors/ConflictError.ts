import BaseError from "./BaseError.js";
import { RESPONSE_CODE, RESPONSE_MESSAGE } from "../constants.js";

import type { IResponse } from "../interfaces/api/response.js";

export default class ConflictError extends BaseError {
    statusCode = 409;
    response?: string;

    constructor(response?: string) {
        super(RESPONSE_MESSAGE.CONFLICT);
        this.response = response;
    }

    public getResponseBody(): IResponse {
        return {
            code: RESPONSE_CODE.CONFLICT,
            message: RESPONSE_MESSAGE.CONFLICT,
            error: { response: this.response },
        };
    }
}
