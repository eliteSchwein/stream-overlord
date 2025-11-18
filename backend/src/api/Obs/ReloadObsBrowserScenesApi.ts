import BaseApi from "../../abstracts/BaseApi";
import {getOBSClient} from "../../App";

export default class ReloadObsBrowserScenesApi extends BaseApi {
    restEndpoint = 'obs/reload_browsers'
    websocketMethod = 'obs_reload_browsers'

    async handle(data: any): Promise<any>
    {
        await getOBSClient().reloadAllBrowserScenes()
    }
}