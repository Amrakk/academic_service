import express from "express";
import { api } from "../api/index.js";

const invitationRouter = express.Router();

invitationRouter.post("/code", api.invitation.generateGroupCode);
invitationRouter.post("/code/:code", api.invitation.submitCode);
invitationRouter.delete("/code/:groupId", api.invitation.removeGroupCode);

invitationRouter.post("/mail", api.invitation.sendInvitationMails);
invitationRouter.post("/mail/accept/:id", api.invitation.acceptInvitation);
invitationRouter.delete("/mail", api.invitation.removeInvitation);

export default invitationRouter;
