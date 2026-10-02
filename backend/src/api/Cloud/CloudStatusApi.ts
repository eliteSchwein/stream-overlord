import BaseApi from "../../abstracts/BaseApi";
import {getCloudClient} from "../../App";

export default class CloudStatusApi extends BaseApi {
    restEndpoint = "cloud/status";
    restPost = false;
    websocketMethod = "cloud_status";

    async handle() {
        return getCloudClient().getState();
    }
}
