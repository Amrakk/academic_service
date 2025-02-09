import express from "express";
import newsRouter from "./newsRouter.js";
import partyRouter from "./partyRouter.js";
import classRouter from "./classRouter.js";
import gradeRouter from "./gradeRouter.js";
import schoolRouter from "./schoolRouter.js";
import commentRouter from "./commentRouter.js";
import subjectRouter from "./subjectRouter.js";
import profileRouter from "./profileRouter.js";
import rollcallRouter from "./rollcallRouter.js";
import invitationRouter from "./invitationRouter.js";
import RouteCollector from "../middlewares/routeCollector.js";
import { BASE_PATH, RESPONSE_CODE, RESPONSE_MESSAGE } from "../constants.js";

const router = express.Router();

router.get("/", (req, res) => {
    res.send("API is working");
});

router.get("/routes", (req, res) => {
    res.status(200).json({
        code: RESPONSE_CODE.SUCCESS,
        message: RESPONSE_MESSAGE.SUCCESS,
        data: RouteCollector.getAllRoutes(),
    });
});

router.use("/news", newsRouter);
router.use("/grades", gradeRouter);
router.use("/classes", classRouter);
router.use("/parties", partyRouter);
router.use("/schools", schoolRouter);
router.use("/comments", commentRouter);
router.use("/subjects", subjectRouter);
router.use("/profiles", profileRouter);
router.use("/rollcall", rollcallRouter);
router.use("/invitations", invitationRouter);

RouteCollector.collectFromRouter(router, `${BASE_PATH}`);

export default router;
