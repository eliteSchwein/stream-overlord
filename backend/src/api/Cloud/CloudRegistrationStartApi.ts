import BaseApi from "../../abstracts/BaseApi";
import {getCloudClient} from "../../App";

export default class CloudRegistrationStartApi extends BaseApi {
    restEndpoint = "cloud/registration/start";
    restPost = true;
    websocketMethod = "cloud_registration_start";

    async handle(data: any) {
        try {
            return await getCloudClient().startRegistration(String(data?.name ?? data?.instance_name ?? ""));
        } catch (error: any) {
            return {error: error?.message ?? "failed to start cloud registration"};
        }
    }
}
