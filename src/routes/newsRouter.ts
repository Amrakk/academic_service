import express from "express";
import { api } from "../api/index.js";
import { imageUploader } from "../middlewares/fileHandlers.js";

const newsRouter = express.Router();

newsRouter.get("", api.news.getGroupNews);
newsRouter.get("/me", api.news.getMyNews);
newsRouter.get("/:groupId/:id", api.news.getById);
newsRouter.get("/latest", api.news.getLatestNews);

newsRouter.post("/:groupId", imageUploader(false), api.news.insert);
newsRouter.patch("/:groupId/:id", imageUploader(false), api.news.updateById);
newsRouter.delete("/:groupId/:id", api.news.deleteById);

export default newsRouter;
