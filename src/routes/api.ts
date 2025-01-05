import express from "express";
import profileRouter from "./profileRouter.js";

const router = express.Router();

router.get("/", (req, res) => {
    res.send("API is working");
});

router.use("/profiles", profileRouter);

export default router;
