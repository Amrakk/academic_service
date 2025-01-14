import express from "express";
import { api } from "../api/index.js";
import { imageUploader } from "../middlewares/fileHandlers.js";

const profileRouter = express.Router();

profileRouter.get("/me", api.profile.getByUserId);
profileRouter.get("/:id", api.profile.getById);

profileRouter.patch("/:id/avatar", imageUploader, api.profile.updateAvatar);
profileRouter.post("/:groupType/:groupId", api.profile.insert);
profileRouter.patch("/:id", api.profile.updateById);

profileRouter.delete("/:id", api.profile.deleteById);

export default profileRouter;
