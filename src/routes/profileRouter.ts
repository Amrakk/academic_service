import express from "express";
import { api } from "../api/index.js";

const profileRouter = express.Router();

profileRouter.get("/:id", api.profile.getById);

export default profileRouter;
