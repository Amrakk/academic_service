import { APP_NAME } from "../constants.js";

import type { IResponse } from "../interfaces/api/response.js";

export default abstract class BaseError extends Error {
    name = `${APP_NAME}Error`;
    abstract statusCode: number;
    constructor(message?: string, options?: ErrorOptions) {
        super(message, options);
    }

    abstract getResponseBody(): IResponse;
}
