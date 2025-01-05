/******************/
/******************/
/**  ENVIRONMENT **/
/******************/
/******************/

// CORE
export const APP_NAME = process.env.APP_NAME!;
export const APP_REGISTRY_KEY = process.env.APP_REGISTRY_KEY!;
export const ENV = process.env.ENV!;
export const PORT = parseInt(process.env.PORT!);
export const BASE_PATH = process.env.BASE_PATH!;
export const ORIGIN = process.env.ORIGIN!;
export const CLIENT_URL = process.env.CLIENT_URL!;
export const ACCESS_POINT_API_URL = process.env.ACCESS_POINT_API_URL!;

// DATABASE
export const MONGO_URI = process.env.MONGO_URI!;
export const MONGO_DEFAULT_DB = process.env.MONGO_DEFAULT_DB ?? APP_NAME;
export const REDIS_URI = process.env.REDIS_URI!;

// LOG
export const LOG_FOLDER = process.env.LOG_FOLDER ?? "logs";
export const ERROR_LOG_FILE = process.env.ERROR_LOG_FILE ?? "error.log";
export const REQUEST_LOG_FILE = process.env.REQUEST_LOG_FILE ?? "request.log";

/******************/
/******************/
/**     ENUM     **/
/******************/
/******************/
export enum RESPONSE_CODE {
    SUCCESS = 0,
    UNAUTHORIZED = 1,
    FORBIDDEN = 3,
    NOT_FOUND = 4,
    BAD_REQUEST = 5,
    VALIDATION_ERROR = 8,
    TOO_MANY_REQUESTS = 9,

    SERVICE_UNAVAILABLE = 99,
    INTERNAL_SERVER_ERROR = 100,
}

export enum RESPONSE_MESSAGE {
    SUCCESS = "Operation completed successfully",
    UNAUTHORIZED = "Access denied! Please provide valid authentication",
    FORBIDDEN = "You don't have permission to access this resource",
    NOT_FOUND = "Resource not found! Please check your data",
    BAD_REQUEST = "The request could not be understood or was missing required parameters",
    VALIDATION_ERROR = "Input validation failed! Please check your data",
    TOO_MANY_REQUESTS = "Too many requests! Please try again later",

    SERVICE_UNAVAILABLE = "Service is temporarily unavailable! Please try again later",
    INTERNAL_SERVER_ERROR = "An unexpected error occurred! Please try again later.",
}

export enum USER_ROLE {
    ADMIN = 0,
    USER = 1,
}
