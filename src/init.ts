import AccessControlService from "./services/external/accessControl.js";

export default async function init() {
    await AccessControlService.serviceRegistry();
}
