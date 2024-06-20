import BaseApi from "./BaseApi";
import {triggerScene} from "../../../helper/SceneHelper";

export default class SceneApi extends BaseApi {
    endpoint = 'scene'
    post = true

    async handle(req: Request) {
        const body = req.body as any

        if(!body.scene) {
            return {
                error: 'scene missing',
                status: 400
            }
        }

        const sceneName = body.scene

        if(!await triggerScene(sceneName)) {
            return {
                error: 'scene not found',
                status: 404
            }
        }

        return {
            status: 200
        }
    }
}