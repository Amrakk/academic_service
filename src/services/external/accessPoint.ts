import ServiceResponseError from "../../errors/ServiceResponseError.js";
import { ACCESS_POINT_API_URL, APP_REGISTRY_KEY, BASE_PATH, ORIGIN, RESPONSE_CODE } from "../../constants.js";

import NotFoundError from "../../errors/NotFoundError.js";

import type { ObjectId } from "mongooat";
import type { IResponse } from "../../interfaces/api/response.js";
import type { IUser } from "../../interfaces/services/external/accessControl.js";

export default class AccessPointService {
    public static async serviceRegistry(): Promise<void> {
        const isDev = process.env.ENV === "development";

        const data = JSON.stringify({
            author: "Amrakk",
            basePath: BASE_PATH,
            name: "Academic Service",
            description: "The Academic Service is responsible for managing academic data.",
            protocol: isDev ? "http" : "https",
            origin: ORIGIN,
            version: "0.0.0",
            paradigm: 0,
        });

        const retry = async (retries: number): Promise<void> => {
            try {
                const res = await fetch(`${ACCESS_POINT_API_URL}/applications/register`, {
                    headers: {
                        "x-app-registry-key": APP_REGISTRY_KEY,
                        "Content-Type": "application/json",
                    },
                    method: "POST",
                    body: data,
                });

                const jsonResponse = await res.json();

                if (jsonResponse.code !== RESPONSE_CODE.SUCCESS) {
                    throw new ServiceResponseError(
                        "AccessPointService",
                        "serviceRegistry",
                        "Failed to register service",
                        jsonResponse
                    );
                }
            } catch (error) {
                if (retries > 0) {
                    console.warn(`Retrying serviceRegistry. Attempts left: ${retries}`);
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                    return retry(retries - 1);
                } else {
                    throw error;
                }
            }
        };

        await retry(3);
    }

    public static async getUserById(userId: string | ObjectId): Promise<IUser> {
        return fetch(`${ACCESS_POINT_API_URL}/users/${userId}`, {
            headers: {
                "x-app-registry-key": APP_REGISTRY_KEY,
            },
        })
            .then((res) => res.json())
            .then((data: IResponse<IUser>) => {
                if (data.code === RESPONSE_CODE.NOT_FOUND) throw new NotFoundError("User not found");
                else if (data.code !== RESPONSE_CODE.SUCCESS)
                    throw new ServiceResponseError("AccessPointService", "getUserById", "Failed to get user", data);

                return data.data!;
            });
    }
}
