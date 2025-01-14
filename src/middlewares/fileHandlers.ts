import multer from "multer";
import { MAX_FILE_SIZE, MAX_IMAGE_SIZE } from "../constants.js";

import { ValidateError } from "mongooat";

import type { NextFunction, Response, Request } from "express";

export const imageUploader = (req: Request, res: Response, next: NextFunction) =>
    multer({
        limits: {
            fileSize: MAX_IMAGE_SIZE,
        },
        fileFilter: (req, file, callback) => {
            if (file.mimetype.startsWith("image/")) callback(null, true);
            else
                callback(
                    new ValidateError("Invalid file type", [
                        { code: "custom", message: "Invalid file type", path: ["image"] },
                    ])
                );
        },
    }).single("image")(req, res, (err) => (err ? next(err) : next()));

export const fileUploader = (req: Request, res: Response, next: NextFunction) =>
    multer({
        limits: {
            fileSize: MAX_FILE_SIZE,
        },
    }).single("file")(req, res, (err) => (err ? next(err) : next()));
