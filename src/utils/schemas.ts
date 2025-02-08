import { z } from "zod";
import { PROFILE_ROLE } from "../constants.js";

export const timebasedPaginationSchema = z
    .object({
        from: z.preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date().optional()),
        limit: z.coerce.number().int().positive().default(10),
    })
    .strict()
    .refine(
        (data) => {
            if (!data.limit && data.from) return false;
            return true;
        },
        {
            message: "'From' date must be provided if 'limit' is provided",
            path: ["limit"],
        }
    );

export const roleSchema = z.preprocess(
    (val) => (val === "[]" ? [] : val ? [val].flat() : val),
    z.array(z.nativeEnum(PROFILE_ROLE)).optional()
);
