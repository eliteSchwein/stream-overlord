import BaseMessage from "./BaseMessage";
import {getAdData} from "../../../website/WebsiteClient";
import {logWarn} from "../../../../helper/LogHelper";

export default class AdMessage extends BaseMessage {
    method = 'get_ads'

    async handle(data: any) {
        try {
            const adData = (await getAdData()).ads
            this.send('ad_result', adData)
        } catch (error) {
            logWarn('ads fetch failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }
}