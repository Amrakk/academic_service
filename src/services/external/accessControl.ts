import ServiceResponseError from "../../errors/ServiceResponseError.js";
import { ACCESS_POINT_API_URL, APP_REGISTRY_KEY, BASE_PATH, ORIGIN } from "../../constants.js";

export default class AccessControlService {
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

        return fetch(`${ACCESS_POINT_API_URL}/applications/register`, {
            headers: {
                "x-app-registry-key": APP_REGISTRY_KEY,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: data,
        })
            .then((res) => res.json())
            .then((res) => {
                if (res.code !== 0)
                    throw new ServiceResponseError(
                        "AccessControlService",
                        "serviceRegistry",
                        "Failed to register service",
                        res
                    );
            });
    }
}
