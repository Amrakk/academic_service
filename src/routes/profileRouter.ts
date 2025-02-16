import express from "express";
import { api } from "../api/index.js";
import { imageUploader } from "../middlewares/fileHandlers.js";

const profileRouter = express.Router();

profileRouter.get("/me", api.profile.getByUserId);
profileRouter.get("/:id", api.profile.getById);

profileRouter.get("/:id/related", api.profile.getRelated);
profileRouter.get("/:groupType/:groupId", api.profile.getByGroup);

profileRouter.post("/:parentId/rels", api.profile.addParentStudentRel);
profileRouter.delete("/:parentId/rels", api.profile.removeParentStudentRel);

profileRouter.patch("/:id/avatar", imageUploader(), api.profile.updateAvatar);
profileRouter.post("/:groupType/:groupId", api.profile.insert);
profileRouter.patch("/:id", api.profile.updateById);

profileRouter.delete("/:id", api.profile.deleteById);

export default profileRouter;
