import BaseApi from "../../abstracts/BaseApi";
import { setAudioOutputVolume } from "../../helper/AudioHelper";

export default class SetAudioOutputVolumeApi extends BaseApi {
    restEndpoint = "set_audio_output_volume";
    restPost = true;
    websocketMethod = "set_audio_output_volume";

    async handle(data: any): Promise<any> {
        if (!data.output) return { error: "missing output" };
        if (data.volume === undefined || data.volume === null) return { error: "missing volume" };

        return await setAudioOutputVolume(data.output, Number(data.volume));
    }
}
