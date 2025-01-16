import BaseApi from "./BaseApi";
import {getGameInfoData} from "../../website/WebsiteClient";

export default class GetGameApi extends BaseApi {
    endpoint = 'get_game'

    async handle(req: Request) {
        const data = await getGameInfoData()

        return {
            status: 200,
            data: data
        }
    }
}