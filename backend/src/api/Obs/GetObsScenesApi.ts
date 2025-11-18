import BaseApi from "../../abstracts/BaseApi";
import {getOBSClient} from "../../App";

export default class GetObsScenesApi extends BaseApi {
    restEndpoint = 'obs/scenes'
    websocketMethod = 'obs_scenes'

    async handle(data: any): Promise<any>
    {
        return getOBSClient().getSceneData()
    }
}