import AccessPointService from "./services/external/accessPoint.js";
import AccessControlService from "./services/external/accessControl.js";

export default async function init() {
    await AccessPointService.serviceRegistry();
    await AccessControlService.rolesPoliciesRegistry();
}
