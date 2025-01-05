import { z } from "zod";
import mongooat from "../db.js";

const profileSchema = z.object({
    createdAt: z
        .preprocess((val) => (typeof val === "string" ? new Date(Date.parse(val)) : val), z.date())
        .default(() => new Date()),
});

export const ProfileModel = mongooat.Model("Profile", profileSchema);

await ProfileModel.dropIndexes();
