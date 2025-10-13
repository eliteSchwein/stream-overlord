import BaseApi from "../BaseApi";
import {getOBSClient} from "../../../../App";

export default class GetSceneDataApi extends BaseApi {
    endpoint = 'obs/scenes'

    async handle(req: Request) {
        const obsClient = getOBSClient()
        const data = obsClient.getSceneData()

        return {
            status: 200,
            data: data
        }
    }
}