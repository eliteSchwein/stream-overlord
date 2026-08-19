import BaseApi from "../../abstracts/BaseApi";
import {saveAudioPreset} from "../../helper/AudioHelper";

export default class SaveAudioPresetApi extends BaseApi {
    restEndpoint = "audio/presets/save";
    restPost = true;
    websocketMethod = "audio_preset_save";

    async handle(data: any): Promise<any> {
        return await saveAudioPreset(
            data?.name,
            data?.include_volumes !== false,
            data?.include_outputs === true,
            Array.isArray(data?.volume_interfaces) ? data.volume_interfaces : [],
            Array.isArray(data?.output_interfaces) ? data.output_interfaces : [],
            data?.output_mappings && typeof data.output_mappings === "object"
                ? data.output_mappings
                : null,
        );
    }
}
