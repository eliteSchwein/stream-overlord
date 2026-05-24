import BaseApi from "../../abstracts/BaseApi";
import {
    linkPipewireSinkToAudioOutput,
    unlinkPipewireSinkFromAudioOutput,
} from "../../helper/AudioHelper";

export default class LinkSinkApi extends BaseApi {
    restEndpoint = "link_sink"
    restPost = true
    websocketMethod = "link_sink"

    async handle(data: any): Promise<any>
    {
        if(!data.interface) return {"error": "missing interface"}

        const shouldUnlink =
            data.unlink === true ||
            data.unlink === "true" ||
            data.linked === false ||
            data.linked === "false" ||
            data.output === null

        if(shouldUnlink) {
            return await unlinkPipewireSinkFromAudioOutput(data.interface, data.output ?? null)
        }

        if(!data.output) return {"error": "missing output"}

        return await linkPipewireSinkToAudioOutput(data.interface, data.output)
    }
}
