import BaseApi from "../../abstracts/BaseApi";
import {applyAudioPreset} from "../../helper/AudioHelper";

export default class ApplyAudioPresetApi extends BaseApi {
    restEndpoint = "audio/presets/apply";
    restPost = true;
    websocketMethod = "audio_preset_apply";

    async handle(data: any): Promise<any> {
        return await applyAudioPreset(data?.name);
    }
}
