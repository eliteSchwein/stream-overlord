import BaseApi from "../../abstracts/BaseApi";
import {getCloudClient} from "../../App";

export default class CloudRegistrationVerifyApi extends BaseApi {
    restEndpoint = "cloud/registration/verify";
    restPost = true;
    websocketMethod = "cloud_registration_verify";

    async handle(data: any) {
        try {
            return await getCloudClient().verifyRegistration(String(data?.pin ?? ""));
        } catch (error: any) {
            return {error: error?.message ?? "failed to verify cloud registration PIN"};
        }
    }
}
