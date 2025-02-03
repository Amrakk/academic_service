import express from "express";
import { api } from "../api/index.js";

const partyRouter = express.Router();

partyRouter.get("/:classId/:id", api.party.getById);
partyRouter.get("/:classId", api.party.getByClassId);

partyRouter.post("/:classId", api.party.insert);
partyRouter.patch("/:classId/:id", api.party.updateById);
partyRouter.patch("/:classId/:id/members", api.party.upsertMembers);
partyRouter.delete("/:classId/:id/members", api.party.removeMembers);

partyRouter.delete("/:classId/:id", api.party.deleteById);

export default partyRouter;
