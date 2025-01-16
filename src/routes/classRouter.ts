import express from "express";
import { api } from "../api/index.js";
import { imageUploader } from "../middlewares/fileHandlers.js";

const classRouter = express.Router();

classRouter.post("/rels/:classId", api.class.bindRelationships);
classRouter.delete("/rels/:classId", api.class.unbindRelationships);

classRouter.get("/:id", api.class.getById);
classRouter.post("/:schoolId?", api.class.insert);
classRouter.patch("/:id", api.class.updateById);
classRouter.patch("/:id/avatar", imageUploader, api.class.updateAvatar);

classRouter.delete("/:id", api.class.deleteById);

export default classRouter;
