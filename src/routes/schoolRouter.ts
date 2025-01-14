import express from "express";
import { api } from "../api/index.js";
import { imageUploader } from "../middlewares/fileHandlers.js";

const schoolRouter = express.Router();

schoolRouter.get("/:id", api.school.getById);

schoolRouter.post("/", api.school.insert);
schoolRouter.patch("/:id", api.school.updateById);
schoolRouter.patch("/:id/avatar", imageUploader, api.school.updateAvatar);

schoolRouter.delete("/:id", api.school.deleteById);

export default schoolRouter;
