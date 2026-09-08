import BaseApi from "../../abstracts/BaseApi";
import {setAudioOutputMute} from "../../helper/AudioHelper";

export default class SetAudioOutputMuteApi extends BaseApi {
    restEndpoint = "audio/output/mute";
    restPost = true;
    websocketMethod = "set_audio_output_mute";

    async handle(data: any): Promise<any> {
        return await setAudioOutputMute(
            String(data?.output ?? ""),
            data?.muted === true,
        );
    }
}
