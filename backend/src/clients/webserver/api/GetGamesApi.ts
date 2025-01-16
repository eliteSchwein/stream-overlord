import BaseApi from "./BaseApi";
import {getGamesInfoData} from "../../website/WebsiteClient";

export default class GetGamesApi extends BaseApi {
    endpoint = 'get_games'

    async handle(req: Request) {
        const data = await getGamesInfoData()

        return {
            status: 200,
            data: data
        }
    }
}