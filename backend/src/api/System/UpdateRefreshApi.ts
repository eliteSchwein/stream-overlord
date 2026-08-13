import BaseApi from "../../abstracts/BaseApi";
import {checkUpdates} from "../../helper/UpdateHelper";

export default class UpdateRefreshApi extends BaseApi {
    restEndpoint = "system/update/refresh";
    websocketMethod = "update_refresh";

    async handle(): Promise<any> {
        return await checkUpdates();
    }
}
