import { ObjectId } from "mongooat";
import mongooat from "../../../database/db.js";
import ApiController from "../../apiController.js";
import ClassService from "../../../services/internal/class.js";
import SchoolService from "../../../services/internal/school.js";
import ProfileService from "../../../services/internal/profile.js";
import InvitationService from "../../../services/internal/invitation.js";
import AccessControlService from "../../../services/external/accessControl.js";
import CommunicationService from "../../../services/external/communication.js";
import {
    CLIENT_URL,
    GROUP_TYPE,
    PROFILE_ROLE,
    RELATIONSHIP,
    RESPONSE_CODE,
    RESPONSE_MESSAGE,
} from "../../../constants.js";

import ConflictError from "../../../errors/ConflictError.js";
import NotFoundError from "../../../errors/NotFoundError.js";
import ForbiddenError from "../../../errors/ForbiddenError.js";
import BadRequestError from "../../../errors/BadRequestError.js";
import ServiceResponseError from "../../../errors/ServiceResponseError.js";

import type { IProfile } from "../../../interfaces/database/profile.js";
import type { IReqInvitation } from "../../../interfaces/api/request.js";
import type { IInvitation } from "../../../interfaces/database/invitation.js";

export const sendInvitationMails = ApiController.callbackFactory<{}, { body: IReqInvitation.SendInvitationMails }, {}>({
    action: "send-invitation-mails",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: (req) => `${req.body.groupId}`,
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const userId = req.ctx.user._id;
            const requestor = req.ctx.profile;
            const { groupId, groupType, role } = req.body;

            if (!requestor)
                throw new ServiceResponseError("AcademicService", "generateGroupCode", "Requestor not found");

            if (
                !AccessControlService.isAllowedToAssignRoles(AccessControlService.getRolesFromId(requestor.roles), [
                    role,
                ])
            )
                throw new ForbiddenError("Requestor is not allowed to assign the specified role");

            let schoolId = undefined;
            let groupName = undefined;
            switch (groupType) {
                case GROUP_TYPE.SCHOOL:
                    const school = await SchoolService.getById(groupId);
                    if (!school) throw new NotFoundError("School not found");

                    groupName = school.name;
                    break;
                case GROUP_TYPE.CLASS:
                    const _class = await ClassService.getById(groupId);
                    if (!_class) throw new NotFoundError("Class not found");

                    groupName = _class.name;
                    schoolId = _class.schoolId;
                    break;
                default:
                    throw new BadRequestError("Invalid group type");
            }

            await session.withTransaction(async () => {
                const insertedData = await InvitationService.insertInvitation(
                    requestor._id,
                    { ...req.body, schoolId },
                    { session }
                );
                const recipients = insertedData.map((data) => ({
                    email: data.email,
                    role: data.role,
                    expiredAt: data.expiredAt,
                    navigateUrl: `${CLIENT_URL}/invitation/${data._id}`, // TODO: Change this to the actual url
                    name: data.email.split("@")[0],
                }));

                const mailData = {
                    groupName,
                    recipients,
                    groupType: `${groupType}`,
                    senderName: requestor.displayName,
                };

                await CommunicationService.sendInvitation(userId, mailData);
            });

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: { message: "Mail are being processed" },
            });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});

export const removeInvitation = ApiController.callbackFactory<
    {},
    { body: IReqInvitation.RemoveInvitation },
    IInvitation
>({
    action: "remove-invitation",
    roleRelationshipPairs: [
        { role: PROFILE_ROLE.TEACHER, relationships: [RELATIONSHIP.CREATOR, RELATIONSHIP.MANAGES] },
    ],
    toId: (req) => `${req.body.groupId}`,
    callback: async (req, res, next) => {
        {
            try {
                const invitation = await InvitationService.removeInvitation(req.body);

                return res.status(200).json({
                    code: RESPONSE_CODE.SUCCESS,
                    message: RESPONSE_MESSAGE.SUCCESS,
                    data: invitation,
                });
            } catch (err) {
                next(err);
            }
        }
    },
});

export const acceptInvitation = ApiController.callbackFactory<{ id: string }, {}, IProfile>({
    action: "accept-invitation",
    roleRelationshipPairs: [],
    toId: "*",
    callback: async (req, res, next) => {
        const session = mongooat.getBase().startSession();
        try {
            const invitation = await InvitationService.getInvitationById(req.params.id);
            if (!invitation) throw new NotFoundError("Invitation not found");

            const { schoolId, groupId, groupType, role, profileId } = invitation;
            let profile: IProfile | undefined;

            await session.withTransaction(async () => {
                const requestor = req.ctx.user;
                const existedProfile = await ProfileService.getByUserGroupIds(requestor._id, groupId);

                if (existedProfile) {
                    if (profileId && `${existedProfile._id}` !== `${profileId}`)
                        throw new ForbiddenError("Profile id does not match with the invitation");

                    const updatingRoles = [
                        ...new Set([...AccessControlService.getRolesFromId(existedProfile.roles), role]),
                    ];

                    if (!AccessControlService.isRolesValid(updatingRoles))
                        throw new ConflictError("Invalid roles invoked by the invitation");

                    profile = existedProfile.roles.includes(role)
                        ? { ...existedProfile }
                        : {
                              ...(await ProfileService.updateById(
                                  existedProfile._id,
                                  { roles: updatingRoles },
                                  { session }
                              )),
                          };

                    // Establish relationship with school class
                    if (schoolId && groupType === GROUP_TYPE.CLASS) {
                        const existingRelationships = await AccessControlService.getRelationshipByFromTo(
                            profile._id,
                            groupId
                        );

                        if (existingRelationships.length === 0)
                            await ProfileService.establishRels([profile], GROUP_TYPE.CLASS, groupId);
                    }
                } else if (profileId) {
                    const targetingProfile = await ProfileService.getByIds(profileId);
                    if (!targetingProfile) throw new NotFoundError("Profile not found");

                    const updatingRoles = [
                        ...new Set([...AccessControlService.getRolesFromId(targetingProfile.roles), role]),
                    ];

                    if (!AccessControlService.isRolesValid(updatingRoles))
                        throw new ConflictError("Invalid roles invoked by the invitation");

                    profile = {
                        ...(await ProfileService.updateById(
                            profileId,
                            {
                                userId: requestor._id,
                                roles: updatingRoles,
                            },
                            { session }
                        )),
                    };

                    // Establish relationship with school class
                    if (schoolId && groupType === GROUP_TYPE.CLASS) {
                        const relationship = ClassService.getRelationshipByRole(role);
                        const relationships = await AccessControlService.getRelationshipsByFrom(profile._id, {
                            relationships: [relationship],
                        });

                        if (relationships.length === 0)
                            await ProfileService.establishRels([profile], GROUP_TYPE.CLASS, groupId);
                    }
                } else {
                    const insertData = {
                        _id: new ObjectId(),
                        displayName: requestor.name,
                        roles: [role],
                        userId: requestor._id,
                    };

                    const groupInfo = {
                        groupId: schoolId ?? groupId,
                        groupType: schoolId ? GROUP_TYPE.SCHOOL : groupType,
                    };

                    const insertedProfiles = await ProfileService.insert([insertData], groupInfo, { session });
                    profile = { ...insertedProfiles[0] };

                    const schoolRelations = schoolId
                        ? [
                              ProfileService.establishRels([profile], GROUP_TYPE.CLASS, groupId),
                              ProfileService.establishRels([profile], GROUP_TYPE.SCHOOL, schoolId),
                          ]
                        : [ProfileService.establishRels([profile], groupType, groupId)];

                    await Promise.all(schoolRelations);
                }

                await InvitationService.removeInvitation({ groupId, groupType, email: invitation.email }, { session });
            });

            if (!profile)
                throw new ServiceResponseError(
                    "AcademicService",
                    "getInvitationData",
                    "Something wrong with profile creation",
                    { id: req.params.id }
                );

            return res.status(200).json({
                code: RESPONSE_CODE.SUCCESS,
                message: RESPONSE_MESSAGE.SUCCESS,
                data: profile,
            });
        } catch (err) {
            next(err);
        } finally {
            session.endSession();
        }
    },
});
