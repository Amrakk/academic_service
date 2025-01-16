import { ObjectId } from "mongooat";
import redis from "../../database/redis.js";
import { generateRandomCode } from "../../utils/generateRandomCode.js";
import { DEFAULT_CODE_LENGTH, GROUP_TYPE, MAX_CODE_GENERATION_ATTEMPTS, PROFILE_ROLE } from "../../constants.js";

import BadRequestError from "../../errors/BadRequestError.js";
import ServiceResponseError from "../../errors/ServiceResponseError.js";

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
}
