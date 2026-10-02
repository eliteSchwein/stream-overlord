import BaseApi from "../../abstracts/BaseApi";
import {getCloudClient} from "../../App";

export default class CloudRegistrationClaimApi extends BaseApi {
    restEndpoint = "cloud/registration/claim";
    restPost = true;
    websocketMethod = "cloud_registration_claim";

    async handle() {
        try {
            return await getCloudClient().claimRegistration();
        } catch (error: any) {
            return {error: error?.message ?? "failed to claim cloud registration"};
        }
    }
}
