import { ObjectId } from "mongooat";
import ProfileService from "../internal/profile.js";
import ServiceResponseError from "../../errors/ServiceResponseError.js";
import { ACCESS_CONTROL_API_URL, PROFILE_ROLE, RELATIONSHIP, RESPONSE_CODE } from "../../constants.js";

import type { IResponse } from "../../interfaces/api/response.js";
import type {
    IReqAccess,
    IRelationship,
    IRoleSimplified,
    IReqRelationship,
} from "../../interfaces/services/external/accessControl.js";

export default class AccessControlService {
    public static roles: Record<PROFILE_ROLE, IRoleSimplified>;
    private static registerRoles?: Record<PROFILE_ROLE, IReqAccess.Node> = {
        [PROFILE_ROLE.EXECUTIVE]: { role: { name: PROFILE_ROLE.EXECUTIVE, privileges: [] }, child: [] },
        [PROFILE_ROLE.TEACHER]: { role: { name: PROFILE_ROLE.TEACHER, privileges: [] }, child: [] },
        [PROFILE_ROLE.STUDENT]: { role: { name: PROFILE_ROLE.STUDENT, privileges: [] }, child: [] },
        [PROFILE_ROLE.PARENT]: { role: { name: PROFILE_ROLE.PARENT, privileges: [] }, child: [] },
    };

    ////////////////////////////
    // ROLE, POLICY FUNCTIONS
    ////////////////////////////

    public static getRolesFromId(id: string | ObjectId): PROFILE_ROLE;
    public static getRolesFromId(ids: (string | ObjectId)[]): PROFILE_ROLE[];
    public static getRolesFromId(ids: string | ObjectId | (string | ObjectId)[]): PROFILE_ROLE | PROFILE_ROLE[] {
        const resolveRole = (id: string | ObjectId): PROFILE_ROLE => {
            for (const [role, details] of Object.entries(AccessControlService.roles)) {
                if (`${details._id}` === `${id}`) return role as PROFILE_ROLE;
            }

            throw new ServiceResponseError("AccessControlService", "getRoleFromId", "Role not found", {
                id,
                roles: AccessControlService.roles,
            });
        };

        if (Array.isArray(ids)) return ids.map((id) => resolveRole(id));
        return resolveRole(ids);
    }

    public static getHighestPriorityRole(roles: PROFILE_ROLE[]): PROFILE_ROLE {
        const rolePriority: Record<PROFILE_ROLE, number> = {
            [PROFILE_ROLE.EXECUTIVE]: 3,
            [PROFILE_ROLE.TEACHER]: 2,
            [PROFILE_ROLE.STUDENT]: 1,
            [PROFILE_ROLE.PARENT]: 0,
        };

        return roles.reduce((highestRole, role) => {
            return rolePriority[role] > rolePriority[highestRole] ? role : highestRole;
        }, roles[0]);
    }

    public static getLowerRoles(role: PROFILE_ROLE): IRoleSimplified[] {
        const rolePriority: Record<PROFILE_ROLE, number> = {
            [PROFILE_ROLE.EXECUTIVE]: 3,
            [PROFILE_ROLE.TEACHER]: 2,
            [PROFILE_ROLE.STUDENT]: 1,
            [PROFILE_ROLE.PARENT]: 0,
        };

        const priority = rolePriority[role];
        return Object.values(AccessControlService.roles).filter(
            (role) => rolePriority[role.name as PROFILE_ROLE] < priority
        );
    }

    public static isAllowedToAssignRoles(fromRoles: PROFILE_ROLE[], toRoles: PROFILE_ROLE[]): boolean {
        const fromRole = this.getHighestPriorityRole(fromRoles);

        switch (fromRole) {
            case PROFILE_ROLE.EXECUTIVE:
                return true;
            case PROFILE_ROLE.TEACHER:
                return !toRoles.includes(PROFILE_ROLE.EXECUTIVE);
            case PROFILE_ROLE.STUDENT:
            case PROFILE_ROLE.PARENT:
            default:
                return false;
        }
    }

    public static isAllowedToViewNews(requestorRoles: PROFILE_ROLE[], targetRoles: PROFILE_ROLE[]): boolean {
        if (targetRoles.length === 0) return true;

        const requestorRole = this.getHighestPriorityRole(requestorRoles);
        switch (requestorRole) {
            case PROFILE_ROLE.EXECUTIVE:
                return true;
            case PROFILE_ROLE.TEACHER:
                return !targetRoles.includes(PROFILE_ROLE.EXECUTIVE);
            case PROFILE_ROLE.STUDENT:
                return targetRoles.length === 1 && targetRoles.includes(PROFILE_ROLE.STUDENT);
            case PROFILE_ROLE.PARENT:
                const targetRole = this.getHighestPriorityRole(targetRoles);
                return [PROFILE_ROLE.STUDENT, PROFILE_ROLE.PARENT].includes(targetRole);
            default:
                return false;
        }
    }

    public static compare(aRole: PROFILE_ROLE, bRole: PROFILE_ROLE): number {
        const rolePriority: Record<PROFILE_ROLE, number> = {
            [PROFILE_ROLE.EXECUTIVE]: 3,
            [PROFILE_ROLE.TEACHER]: 2,
            [PROFILE_ROLE.STUDENT]: 1,
            [PROFILE_ROLE.PARENT]: 0,
        };

        return rolePriority[aRole] - rolePriority[bRole];
    }

    public static isRolesValid(roles: PROFILE_ROLE[]): boolean {
        const hasStudent = roles.find((role) => role === PROFILE_ROLE.STUDENT);

        if (hasStudent) return roles.length === 1;
        return true;
    }

    public static roleRegistry(role: PROFILE_ROLE, action: string, relationships: string[]): void {
        if (!AccessControlService.registerRoles)
            AccessControlService.registerRoles = {
                [PROFILE_ROLE.EXECUTIVE]: { role: { name: PROFILE_ROLE.EXECUTIVE, privileges: [] }, child: [] },
                [PROFILE_ROLE.TEACHER]: { role: { name: PROFILE_ROLE.TEACHER, privileges: [] }, child: [] },
                [PROFILE_ROLE.STUDENT]: { role: { name: PROFILE_ROLE.STUDENT, privileges: [] }, child: [] },
                [PROFILE_ROLE.PARENT]: { role: { name: PROFILE_ROLE.PARENT, privileges: [] }, child: [] },
            };

        AccessControlService.registerRoles[role].role.privileges.push(
            ...relationships.map((relationship) => ({ action, relationship }))
        );
    }

    public static async rolesPoliciesRegistry(): Promise<void> {
        if (!AccessControlService.registerRoles)
            throw new ServiceResponseError(
                "AccessControlService",
                "serviceRegistry",
                "Roles and policies not collected",
                {
                    registerRoles: AccessControlService.registerRoles,
                }
            );

        AccessControlService.registerRoles.Teacher.child = [AccessControlService.registerRoles.Executive];

        const data: IReqAccess.Register = {
            roles: [
                AccessControlService.registerRoles.Parent,
                AccessControlService.registerRoles.Student,
                AccessControlService.registerRoles.Teacher,
            ],
        };

        const retry = async (retries: number): Promise<void> => {
            try {
                return await fetch(`${ACCESS_CONTROL_API_URL}/access/register`, {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    method: "POST",
                    body: JSON.stringify(data),
                })
                    .then((res) => res.json())
                    .then((res: IResponse<IRoleSimplified[]>) => {
                        if (res.code !== RESPONSE_CODE.SUCCESS || !res.data)
                            throw new ServiceResponseError(
                                "AccessControlService",
                                "serviceRegistry",
                                "Failed to register roles and policies",
                                res
                            );

                        AccessControlService.roles = res.data.reduce((acc, { _id, ...role }) => {
                            acc[role.name as PROFILE_ROLE] = { ...role, _id: new ObjectId(_id) };
                            return acc;
                        }, {} as Record<PROFILE_ROLE, IRoleSimplified>);

                        delete AccessControlService.registerRoles;
                    });
            } catch (error) {
                if (retries > 0) {
                    console.warn(`Retrying rolesPoliciesRegistry. Attempts left: ${retries}`);
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                    return retry(retries - 1);
                } else {
                    throw error;
                }
            }
        };

        await retry(5);
    }

    public static async authorize(
        fromId: string | ObjectId,
        toId: string | ObjectId,
        action: string
    ): Promise<boolean> {
        try {
            const from = await ProfileService.getByIds(fromId);
            if (!from) return false;

            return fetch(`${ACCESS_CONTROL_API_URL}/access/authorize`, {
                headers: {
                    "Content-Type": "application/json",
                },
                method: "POST",
                body: JSON.stringify({
                    fromId,
                    toId,
                    fromRoleIds: from.roles,
                    action,
                }),
            })
                .then((res) => res.json())
                .then((res: IResponse) => {
                    if (res.code === RESPONSE_CODE.FORBIDDEN || res.code === RESPONSE_CODE.NOT_FOUND) return false;
                    if (res.code === RESPONSE_CODE.SUCCESS) return true;

                    throw new ServiceResponseError("AccessControlService", "authorize", "Unknown response", res);
                });
        } catch (err) {
            return false;
        }
    }

    ////////////////////////////
    // RELATIONSHIP FUNCTIONS
    ////////////////////////////

    public static async bindRelationships(data: IReqRelationship.Bind) {
        return fetch(`${ACCESS_CONTROL_API_URL}/relationships/bind`, {
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify(data),
        })
            .then((res) => res.json())
            .then((res: IResponse) => {
                if (res.code !== RESPONSE_CODE.SUCCESS)
                    throw new ServiceResponseError(
                        "AccessControlService",
                        "bindRelationship",
                        "Failed to bind relationship",
                        res
                    );
            });
    }

    public static async unbindRelationships(data: IReqRelationship.Unbind) {
        return fetch(`${ACCESS_CONTROL_API_URL}/relationships/unbind`, {
            headers: {
                "Content-Type": "application/json",
            },
            method: "DELETE",
            body: JSON.stringify(data),
        })
            .then((res) => res.json())
            .then((res: IResponse) => {
                if (res.code !== RESPONSE_CODE.SUCCESS)
                    throw new ServiceResponseError(
                        "AccessControlService",
                        "unbindRelationship",
                        "Failed to unbind relationship",
                        res
                    );
            });
    }

    public static async getRelationshipsByTo(to: string | ObjectId, query?: IReqRelationship.Query) {
        const { relationships } = query || {};
        let url = new URL(`${ACCESS_CONTROL_API_URL}/relationships/to/${to}`);

        if (relationships) relationships.forEach((rel) => url.searchParams.append("relationships", rel));
        return fetch(url, {
            headers: {
                "Content-Type": "application/json",
            },
            method: "GET",
        })
            .then((res) => res.json())
            .then((res: IResponse<IRelationship[]>) => {
                if (res.code !== RESPONSE_CODE.SUCCESS)
                    throw new ServiceResponseError(
                        "AccessControlService",
                        "getRelationshipsByTo",
                        "Failed to get relationships",
                        res
                    );

                return (res.data ?? []).map((rel) => ({
                    _id: new ObjectId(`${rel._id}`),
                    from: new ObjectId(`${rel.from}`),
                    to: new ObjectId(`${rel.to}`),
                    relationship: rel.relationship,
                }));
            });
    }

    public static async getRelationshipsByFrom(from: string | ObjectId, query?: IReqRelationship.Query) {
        const { relationships } = query || {};
        let url = new URL(`${ACCESS_CONTROL_API_URL}/relationships/from/${from}`);

        if (relationships) relationships.forEach((rel) => url.searchParams.append("relationships", rel));
        return fetch(url, {
            headers: {
                "Content-Type": "application/json",
            },
            method: "GET",
        })
            .then((res) => res.json())
            .then((res: IResponse<IRelationship[]>) => {
                if (res.code !== RESPONSE_CODE.SUCCESS)
                    throw new ServiceResponseError(
                        "AccessControlService",
                        "getRelationshipsByFrom",
                        "Failed to get relationships",
                        res
                    );

                return (res.data ?? []).map((rel) => ({
                    _id: new ObjectId(`${rel._id}`),
                    from: new ObjectId(`${rel.from}`),
                    to: new ObjectId(`${rel.to}`),
                    relationship: rel.relationship,
                }));
            });
    }

    public static async getRelationshipByFromTo(from: string | ObjectId, to: string | ObjectId) {
        return fetch(`${ACCESS_CONTROL_API_URL}/relationships/${from}/${to}`, {
            headers: {
                "Content-Type": "application/json",
            },
            method: "GET",
        })
            .then((res) => res.json())
            .then((res: IResponse<IRelationship[]>) => {
                if (res.code !== RESPONSE_CODE.SUCCESS)
                    throw new ServiceResponseError(
                        "AccessControlService",
                        "unbindRelationship",
                        "Failed to unbind relationship",
                        res
                    );

                return (res.data ?? []).map((rel) => ({
                    _id: new ObjectId(`${rel._id}`),
                    from: new ObjectId(`${rel.from}`),
                    to: new ObjectId(`${rel.to}`),
                    relationship: rel.relationship,
                }));
            });
    }

    public static async upsertRelationships(data: IReqRelationship.Upsert[]) {
        return fetch(`${ACCESS_CONTROL_API_URL}/relationships`, {
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify(data),
        })
            .then((res) => res.json())
            .then((res: IResponse) => {
                if (res.code !== RESPONSE_CODE.SUCCESS)
                    throw new ServiceResponseError(
                        "AccessControlService",
                        "establishRelationship",
                        "Failed to establish relationship",
                        res
                    );
            });
    }

    public static async updateByFromTo(from: string, to: string, relationships: string) {
        return fetch(`${ACCESS_CONTROL_API_URL}/relationships`, {
            headers: {
                "Content-Type": "application/json",
            },
            method: "PATCH",
            body: JSON.stringify({ from, to, relationships, excludes: [RELATIONSHIP.CREATOR] }),
        })
            .then((res) => res.json())
            .then((res: IResponse) => {
                if (res.code !== RESPONSE_CODE.SUCCESS)
                    throw new ServiceResponseError(
                        "AccessControlService",
                        "updateRelationship",
                        "Failed to update relationship",
                        res
                    );
            });
    }

    public static async deleteRelationshipByProfileIds(ids: (string | ObjectId)[]) {
        return fetch(`${ACCESS_CONTROL_API_URL}/relationships`, {
            headers: {
                "Content-Type": "application/json",
            },
            method: "DELETE",
            body: JSON.stringify({ ids }),
        })
            .then((res) => res.json())
            .then((res: IResponse) => {
                if (res.code !== RESPONSE_CODE.SUCCESS)
                    throw new ServiceResponseError(
                        "AccessControlService",
                        "deleteRelationshipByIds",
                        "Failed to delete relationships",
                        res
                    );
            });
    }
}
