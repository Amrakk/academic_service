import express from "express";
import { api } from "../api/index.js";

const commentRouter = express.Router();

commentRouter.get("/:newsId", api.comment.getByNewsId);
commentRouter.get("/:newsId/latest", api.comment.getLatestComments);

commentRouter.post("/:newsId", api.comment.insert);
commentRouter.patch("/:newsId/:id", api.comment.updateById);
commentRouter.delete("/:newsId/:id", api.comment.deleteById);

export default commentRouter;
