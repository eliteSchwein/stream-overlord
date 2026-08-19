import BaseApi from "../../abstracts/BaseApi";
import {deleteAudioPreset} from "../../helper/AudioHelper";

export default class DeleteAudioPresetApi extends BaseApi {
    restEndpoint = "audio/presets/delete";
    restPost = true;
    websocketMethod = "audio_preset_delete";

    async handle(data: any): Promise<any> {
        return await deleteAudioPreset(data?.name);
    }
}
