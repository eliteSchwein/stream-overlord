import BaseApi from "../../abstracts/BaseApi";
import {setAudioLinkVolume} from "../../helper/AudioHelper";

export default class SetAudioLinkVolumeApi extends BaseApi {
    restEndpoint = 'set_link_volume'
    restPost = true
    websocketMethod = 'set_link_volume'

    async handle(data: any): Promise<any>
    {
        if(!data.interface) return {"error": "missing interface"}
        if(!data.output) return {"error": "missing output"}
        if(data.volume === undefined || data.volume === null) return {"error": "missing volume"}

        return await setAudioLinkVolume(String(data.interface), String(data.output), Number(data.volume))
    }
}
