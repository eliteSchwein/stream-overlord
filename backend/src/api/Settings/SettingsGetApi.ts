import {getSettings} from "../../helper/ConfigHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class SettingsGetApi extends BaseApi {
    restEndpoint = "settings/get";
    restPost = false;
    websocketMethod = "settings_get";

    async handle(): Promise<any> {
        return getSettings();
    }
}
