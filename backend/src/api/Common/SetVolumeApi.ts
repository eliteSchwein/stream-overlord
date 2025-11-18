import BaseApi from "../../abstracts/BaseApi";
import {setVolume} from "../../helper/AudioHelper";

export default class SetVolumeApi extends BaseApi {
    restEndpoint = 'set_volume'
    restPost = true
    websocketMethod = 'set_volume'

    async handle(data: any): Promise<any>
    {
        if(!data.interface) return {"error": "missing interface"}
        if(!data.volume) return {"error": "missing volume"}

        await setVolume(data.interface, data.volume)
    }
}