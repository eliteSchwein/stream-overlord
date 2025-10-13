import BaseApi from "../BaseApi";
import {getOBSClient} from "../../../../App";

export default class ReloadBrowserScenesApi extends BaseApi {
    endpoint = 'obs/reload_browsers'

    async handle(req: Request) {
        const obsClient = getOBSClient()
        await obsClient.reloadAllBrowserScenes()

        return {
            status: 200
        }
    }
}