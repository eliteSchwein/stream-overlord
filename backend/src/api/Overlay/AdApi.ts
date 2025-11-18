import BaseApi from "../../abstracts/BaseApi";
import {getAdData} from "../../clients/website/WebsiteClient";
import {logWarn} from "../../helper/LogHelper";

export default class AdApi extends BaseApi {
    restEndpoint = 'ads'
    websocketMethod = 'get_ads'

    async handle(data: any): Promise<any>
    {
        try {
            // @ts-ignore
            const adData = (await getAdData()).ads
            this.sendWebsocket('notify_ads', adData)
            return adData
        } catch (error) {
            logWarn('ads fetch failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }
}