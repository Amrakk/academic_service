import express from "express";
import classRouter from "./classRouter.js";
import schoolRouter from "./schoolRouter.js";
import profileRouter from "./profileRouter.js";
import rollcallRouter from "./rollcallRouter.js";
import invitationRouter from "./invitationRouter.js";
import RouteCollector from "../middlewares/routeCollector.js";
import { BASE_PATH, RESPONSE_CODE, RESPONSE_MESSAGE } from "../constants.js";
import partyRouter from "./partyRouter.js";

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

router.use("/classes", classRouter);
router.use("/parties", partyRouter);
router.use("/schools", schoolRouter);
router.use("/profiles", profileRouter);
router.use("/rollcall", rollcallRouter);
router.use("/invitations", invitationRouter);

RouteCollector.collectFromRouter(router, `${BASE_PATH}`);

export default router;
