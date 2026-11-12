import BaseApi from "../../abstracts/BaseApi";
import {setAudioPerLinkControl} from "../../helper/AudioHelper";

export default class SetAudioPerLinkControlApi extends BaseApi {
    restEndpoint = 'set_per_link_control'
    restPost = true
    websocketMethod = 'set_per_link_control'

    async handle(data: any): Promise<any>
    {
        if(!data.interface) return {"error": "missing interface"}

        const enabled = data.enabled === true || data.enabled === "true"

        return await setAudioPerLinkControl(String(data.interface), enabled)
    }
}
