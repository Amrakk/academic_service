import express from "express";
import { api } from "../api/index.js";

const rollcallRouter = express.Router();

rollcallRouter.get("/class/:classId", api.rollcall.getRollCallSessions);
rollcallRouter.get("/:sessionId", api.rollcall.getRollCallEntriesBySessionId);

rollcallRouter.post("/class/:classId", api.rollcall.createRollCallSession);
rollcallRouter.delete("/:sessionId", api.rollcall.removeRollCallSession);

rollcallRouter.post("/:sessionId", api.rollcall.insertRollCallEntries);
rollcallRouter.patch("/entry/:entryId", api.rollcall.updateRollCallEntry);
rollcallRouter.delete("/entry/:entryId", api.rollcall.deleteRollCallEntry);

export default rollcallRouter;
