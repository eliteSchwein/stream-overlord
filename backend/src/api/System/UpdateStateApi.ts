import BaseApi from "../../abstracts/BaseApi";
import {getUpdateManagerStatus} from "../../helper/UpdateHelper";

export default class UpdateStateApi extends BaseApi {
    restEndpoint = "system/update/state";
    websocketMethod = "update_state";

    async handle(): Promise<any> {
        return getUpdateManagerStatus();
    }
}
