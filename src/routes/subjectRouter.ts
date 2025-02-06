import express from "express";
import { api } from "../api/index.js";

const subjectRouter = express.Router();

subjectRouter.get("/:classId/:id", api.subject.getById);
subjectRouter.get("/:classId", api.subject.getByClassId);

subjectRouter.post("/:classId", api.subject.insert);
subjectRouter.patch("/:classId/:id", api.subject.updateById);
subjectRouter.patch("/:classId/:id/grade", api.subject.addGradeTypes);
subjectRouter.delete("/:classId/:id/grade", api.subject.removeGradeTypes);

subjectRouter.delete("/:classId/:id", api.subject.deleteById);

export default subjectRouter;
