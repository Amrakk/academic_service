import { COMMUNICATION_API_URL } from "../../constants.js";

import ServiceResponseError from "../../errors/ServiceResponseError.js";

import type { ObjectId } from "mongooat";
import type { IReqMail } from "../../interfaces/services/external/communication.js";

export default class CommunicationService {
    public static async sendInvitation(userId: string | ObjectId, data: IReqMail.SendInvitation): Promise<void> {
        return fetch(`${COMMUNICATION_API_URL}/mail/send-invitation`, {
            headers: {
                "Content-Type": "application/json",
                "x-user-id": `${userId}`,
            },
            method: "POST",
            body: JSON.stringify(data),
        })
            .then((res) => res.json())
            .then((res) => {
                if (res.code !== 0)
                    throw new ServiceResponseError(
                        "CommunicationService",
                        "sendForgotOTP",
                        "Failed to send OTP to email",
                        res
                    );
            });
    }
}
