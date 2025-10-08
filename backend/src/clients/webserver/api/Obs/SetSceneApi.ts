import BaseApi from "../BaseApi";
import {getOBSClient} from "../../../../App";

export default class SetSceneApi extends BaseApi {
    endpoint = "obs/set_scene";
    post = true

    async handle(req: Request) {
        const body = req.body as any

        if(!body.sceneUuid && !body.sceneName) {
            return {
                error: 'scene missing',
                status: 400
            }
        }

        const obsClient = getOBSClient()

        if(body.sceneName) {
            await obsClient.send('SetCurrentProgramScene', {sceneName: body.sceneName})
        }
        if(body.sceneUuid) {
            await obsClient.send('SetCurrentProgramScene', {sceneUuid: body.sceneUuid})
        }

        return {
            status: 200
        }
    }
}