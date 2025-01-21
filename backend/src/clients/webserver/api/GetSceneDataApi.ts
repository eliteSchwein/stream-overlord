import BaseApi from "./BaseApi";
import {getGameInfoData} from "../../website/WebsiteClient";
import {getOBSClient} from "../../../App";

export default class GetSceneDataApi extends BaseApi {
    endpoint = 'get_scene_data'

    async handle(req: Request) {
        const obsClient = getOBSClient()
        const data = obsClient.getSceneData()

        return {
            status: 200,
            data: data
        }
    }
}