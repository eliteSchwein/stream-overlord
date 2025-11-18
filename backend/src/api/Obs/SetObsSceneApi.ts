import BaseApi from "../../abstracts/BaseApi";
import {getOBSClient} from "../../App";

export default class SetObsSceneApi extends BaseApi {
    restEndpoint = 'obs/set_scene'
    restPost = true
    websocketMethod = 'obs_set_scene'

    async handle(data: any): Promise<any>
    {
        if(!data.sceneUuid && !data.sceneName) return {"error": "scene missing"}

        const obsClient = getOBSClient()

        if(data.sceneName) {
            await obsClient.send('SetCurrentProgramScene', {sceneName: data.sceneName})
        }
        if(data.sceneUuid) {
            await obsClient.send('SetCurrentProgramScene', {sceneUuid: data.sceneUuid})
        }
    }
}