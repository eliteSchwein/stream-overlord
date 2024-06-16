import BaseMessage from "./BaseMessage";
import {getAdData} from "../../../website/WebsiteClient";

export default class AdMessage extends BaseMessage {
    method = 'get_ads'

    async handle(data: any) {
        const adData = (await getAdData()).ads
        this.webSocket.send(JSON.stringify({
            method: 'ad_result',
            data: adData
        }))
    }
}