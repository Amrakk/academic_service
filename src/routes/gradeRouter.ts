import express from "express";
import { api } from "../api/index.js";

const gradeRouter = express.Router();

gradeRouter.get("/student/:studentId", api.grade.getByStudentId);
gradeRouter.get("/subject/:subjectId", api.grade.getBySubjectId);
gradeRouter.get("/subject/:subjectId/:gradeTypeId", api.grade.getByGradeTypeId);
gradeRouter.get("/student/:studentId/subject/:subjectId", api.grade.getByStudentAndSubjectId);

gradeRouter.post("/subject/:subjectId", api.grade.insert);
gradeRouter.patch("/subject/:subjectId/:id", api.grade.updateById);
gradeRouter.delete("/subject/:subjectId/:id", api.grade.deleteById);

export default gradeRouter;
