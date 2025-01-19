import redis from "../../database/redis.js";
import { ObjectId, z, ZodObjectId } from "mongooat";
import { InvitationModel } from "../../database/models/invitation.js";
import { generateRandomCode } from "../../utils/generateRandomCode.js";
import {
    GROUP_TYPE,
    PROFILE_ROLE,
    DEFAULT_CODE_LENGTH,
    MAX_CODE_GENERATION_ATTEMPTS,
    DEFAULT_INVITATION_MAIL_EXPIRE_TIME,
} from "../../constants.js";

import NotFoundError from "../../errors/NotFoundError.js";
import BadRequestError from "../../errors/BadRequestError.js";
import ServiceResponseError from "../../errors/ServiceResponseError.js";

import type { ClientSession } from "mongodb";
import type { IReqInvitation } from "../../interfaces/api/request.js";
import type { IInvitation } from "../../interfaces/database/invitation.js";

export interface InvitationCodeData {
    groupId: ObjectId;
    groupType: GROUP_TYPE;
    newProfileRole: PROFILE_ROLE;
    schoolId?: ObjectId;
    expireMinutes: number;
}

export default class InvitationService {
    private static readonly groupCodePrefix = "group_code:";

    public static async generateInvitationCode(data: InvitationCodeData): Promise<string> {
        const cache = redis.getRedis();
        const { expireMinutes } = data;

        let code = await cache.get(`${this.groupCodePrefix}${data.groupId}`);
        if (code) return code;

        const getUniqueCode = async (code: string, attempts: number = 0): Promise<string> => {
            if (attempts >= MAX_CODE_GENERATION_ATTEMPTS)
                throw new ServiceResponseError(
                    "InvitationService",
                    "generateInvitationCode",
                    "Failed to generate unique code"
                );

            return (await cache.get(`${this.groupCodePrefix}${code}`))
                ? getUniqueCode(generateRandomCode(DEFAULT_CODE_LENGTH), attempts + 1)
                : code;
        };

        code = await getUniqueCode(generateRandomCode(DEFAULT_CODE_LENGTH));
        await Promise.all([
            cache.set(`${this.groupCodePrefix}${code}`, JSON.stringify(data), "EX", expireMinutes * 60),
            cache.set(`${this.groupCodePrefix}${data.groupId}`, code, "EX", expireMinutes * 60),
        ]);

        return code;
    }

    public static async removeCode(groupId: string | ObjectId): Promise<void> {
        const cache = redis.getRedis();
        const code = await cache.get(`${this.groupCodePrefix}${groupId}`);
        if (!code) return;

        await Promise.all([
            cache.del(`${this.groupCodePrefix}${code}`),
            cache.del(`${this.groupCodePrefix}${groupId}`),
        ]);
    }

    public static async getInvitationData(code: string): Promise<InvitationCodeData> {
        const cache = redis.getRedis();
        const cacheData = await cache.get(`${this.groupCodePrefix}${code}`);
        if (!cacheData) throw new BadRequestError("Invalid code");

        const data = JSON.parse(cacheData) as InvitationCodeData;
        data.groupId = new ObjectId(`${data.groupId}`);
        data.schoolId = data.schoolId ? new ObjectId(`${data.schoolId}`) : undefined;

        return data;
    }

    // MAIL INVITATION
    public static async getInvitationById(id: string | ObjectId): Promise<IInvitation | null> {
        const result = await ZodObjectId.safeParseAsync(id);
        if (result.error) throw new NotFoundError("Invitation not found");

        return InvitationModel.findById(result.data);
    }

    public static async insertInvitation(
        senderId: ObjectId,
        data: IReqInvitation.SendInvitationMails & { schoolId?: ObjectId },
        options?: { session?: ClientSession }
    ): Promise<IInvitation[]> {
        const result = await z.array(z.string()).safeParseAsync(data.emails);
        if (result.error) throw new BadRequestError("Invalid data", { errors: result.error.errors });

        const expireMinutesValidation = await z.coerce.number().int().positive().safeParseAsync(data.expireMinutes);
        if (expireMinutesValidation.error)
            throw new BadRequestError("Invalid data", { errors: expireMinutesValidation.error.errors });

        const insertData = result.data.map((email) => ({
            email,
            senderId,
            role: data.role,
            groupId: data.groupId,
            schoolId: data.schoolId,
            groupType: data.groupType,
            profileId: data.profileId,
            expiredAt: new Date(
                Date.now() + (expireMinutesValidation.data || DEFAULT_INVITATION_MAIL_EXPIRE_TIME) * 60 * 1000
            ),
        }));

        return InvitationModel.insertMany(insertData, { session: options?.session });
    }

    public static async removeInvitation(
        data: IReqInvitation.RemoveInvitation,
        options?: { session?: ClientSession }
    ): Promise<IInvitation> {
        const result = await ZodObjectId.safeParseAsync(data.groupId);
        if (result.error) throw new NotFoundError("Group not found");

        const invitation = await InvitationModel.findOneAndDelete(
            {
                email: data.email,
                groupId: result.data,
                groupType: data.groupType,
            },
            { session: options?.session }
        );

        if (!invitation) throw new NotFoundError("Invitation not found");
        return invitation;
    }
}
