import ApiController from "../../apiController.js";
import ClassService from "../../../services/internal/class.js";
import AccessControlService from "../../../services/external/accessControl.js";
import { PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE, RESPONSE_MESSAGE } from "../../../constants.js";

import NotFoundError from "../../../errors/NotFoundError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IClass } from "../../../interfaces/database/class.js";

export const getBySchoolId = ApiController.callbackFactory<{ schoolId: string }, {}, IClass[]>({
    action: "view-classes",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.EXECUTIVE, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.EMPLOYED_AT] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.STUDIES_AT] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.ASSOCIATED_WITH] },
    ],
    toId: (req) => req.params.schoolId,
    callback: async (req, res, next) => {
        try {
            const { schoolId } = req.params;
            const requestor = req.ctx.profile;

            if (!requestor) throw new ServiceResponseError("Academic Service", "getBySchoolId", "Requestor not found");

            const requestorRoles = AccessControlService.getRolesFromId(requestor.roles);
            const highestRole = AccessControlService.getHighestPriorityRole(requestorRoles);

            const [classes, relationships] = await Promise.all([
                ClassService.getBySchoolId(schoolId),
                highestRole === PROFILE_ROLE.EXECUTIVE
                    ? undefined
                    : (async () => {
                          let relationshipQuery: RELATIONSHIP[] = [];
                          requestorRoles.forEach((role) => {
                              if (role === PROFILE_ROLE.EXECUTIVE)
                                  relationshipQuery.push(RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES);
                              if (role === PROFILE_ROLE.TEACHER) relationshipQuery.push(RELATIONSHIP.MANAGES);
                              if (role === PROFILE_ROLE.STUDENT) relationshipQuery.push(RELATIONSHIP.ENROLLED_IN);
                              if (role === PROFILE_ROLE.PARENT) relationshipQuery.push(RELATIONSHIP.HAS_CHILD_IN);
                          });

                          return AccessControlService.getRelationshipsByFrom(requestor._id, {
                              relationships: relationshipQuery,
                          });
                      })(),
            ]);

            let classesFiltered = classes;
            if (relationships) {
                const relatedGroups = relationships.map((relationship) => `${relationship.to}`);
                classesFiltered = classes.filter((_class) => relatedGroups.includes(`${_class._id}`));
            }

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: classesFiltered,
            });
        } catch (err) {
            next(err);
        }
    },
});

export const getById = ApiController.callbackFactory<{ id: string }, {}, IClass>({
    action: "view-class",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
        { role: PROFILE_ROLE.STUDENT, relationships: [RELATIONSHIP.ENROLLED_IN] },
        { role: PROFILE_ROLE.PARENT, relationships: [RELATIONSHIP.HAS_CHILD_IN] },
    ],
    toId: (req) => req.params.id,
    callback: async (req, res, next) => {
        try {
            const { id } = req.params;

            const _class = await ClassService.getById(id);
            if (!_class) throw new NotFoundError("Class not found");

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: _class,
            });
        } catch (err) {
            next(err);
        }
    },
});
