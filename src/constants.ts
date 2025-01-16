import ms from "ms";

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

// LIMITS
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE!);
export const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE!);
export const MAX_CODE_GENERATION_ATTEMPTS = parseInt(process.env.MAX_CODE_GENERATION_ATTEMPTS!);

// DEFAULT
export const DEFAULT_CODE_LENGTH = parseInt(process.env.DEFAULT_CODE_LENGTH!);
export const DEFAULT_CODE_EXPIRE_TIME = ms(process.env.DEFAULT_CODE_EXPIRE_TIME!);
export const DEFAULT_CLASS_AVATAR_URL = process.env.DEFAULT_CLASS_AVATAR_URL!;
export const DEFAULT_SCHOOL_AVATAR_URL = process.env.DEFAULT_SCHOOL_AVATAR_URL!;
export const DEFAULT_PROFILE_AVATAR_URL = process.env.DEFAULT_PROFILE_AVATAR_URL!;

// DATABASE
export const MONGO_URI = process.env.MONGO_URI!;
export const MONGO_DEFAULT_DB = process.env.MONGO_DEFAULT_DB ?? APP_NAME;
export const REDIS_URI = process.env.REDIS_URI!;

// LOG
export const LOG_FOLDER = process.env.LOG_FOLDER ?? "logs";
export const ERROR_LOG_FILE = process.env.ERROR_LOG_FILE ?? "error.log";
export const REQUEST_LOG_FILE = process.env.REQUEST_LOG_FILE ?? "request.log";

// IMGBB
export const IMGBB_API_KEY = process.env.IMGBB_API_KEY!;
export const IMGBB_API_URL = process.env.IMGBB_API_URL!;

// CORE SERVICES
export const ACCESS_POINT_API_URL = process.env.ACCESS_POINT_API_URL!;
export const COMMUNICATION_API_URL = process.env.COMMUNICATION_API_URL!;
export const ACCESS_CONTROL_API_URL = process.env.ACCESS_CONTROL_API_URL!;

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

export enum PROFILE_ROLE {
    EXECUTIVE = "Executive",
    TEACHER = "Teacher",
    STUDENT = "Student",
    PARENT = "Parent",
}

export enum RELATIONSHIP {
    /** Mapped to who owns the profile */
    OWN = "own",
    /** Mapped to who created the resources (schools | classes) */
    CREATOR = "creator",

    // GENERAL RELATIONSHIPS
    /** Mapped to profiles that can view resources (e.g., schools, classes, students) */
    VIEWER = "viewer",
    /** Mapped to profiles that can edit resources (e.g., schools, classes, students) */
    EDITOR = "editor",
    /** Mapped to profiles that can delete resources */
    REMOVER = "remover",

    // TEACHER
    /** Mapped to students */
    TEACHES = "teaches",
    /** Mapped to groups (classes | schools) */
    MANAGES = "manages",
    /** Mapped to schools */
    EMPLOYED_AT = "employed-at",
    /** Mapped to parents */
    SUPERVISES_PARENTS = "supervises-parents",
    /** Mapped to lessons or assignments created by the teacher */
    ASSIGNS_TASKS = "assigns-tasks",
    /** Mapped to grades given to students */
    GRADES = "grades",
    /** Mapped to student progress reports */
    TRACKS_PROGRESS = "tracks-progress",

    // EXECUTIVE (inherits TEACHER)
    /** Mapped to teachers under their supervision */
    SUPERVISES_TEACHERS = "supervises-teachers",
    /** Mapped to class schedules, assignments, or administrative tasks */
    OVERSEES_OPERATION = "oversees-operation",
    /** Mapped to school-wide or class-wide reports */
    REVIEWS_REPORTS = "reviews-reports",

    // STUDENT
    /** Mapped to schools */
    STUDIES_AT = "studies-at",
    /** Mapped to classes */
    ENROLLED_IN = "enrolled-in",
    /** Mapped to parents */
    GUARDED_BY = "guarded-by",
    /** Mapped to lessons or assignments assigned to the student */
    ASSIGNED_TO = "assigned-to",

    // PARENT
    /** Mapped to schools */
    ASSOCIATED_WITH = "associated-with",
    /** Mapped to classes */
    HAS_CHILD_IN = "has-child-in",
    /** Mapped to students */
    PARENT_OF = "parent-of",
    /** Mapped to teachers or executives */
    COMMUNICATES_WITH = "communicates-with",
    /** Mapped to the student's academic records */
    VIEWS_RECORDS = "views-records",
    /** Mapped to tasks assigned to their child (e.g., assignments, schedules) */
    TRACKS_TASKS = "tracks-tasks",
}

export enum GROUP_TYPE {
    SCHOOL = 0,
    CLASS = 1,
}
