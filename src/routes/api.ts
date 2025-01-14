import express from "express";
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

RouteCollector.collectFromRouter(router, `${BASE_PATH}`);

export default router;
