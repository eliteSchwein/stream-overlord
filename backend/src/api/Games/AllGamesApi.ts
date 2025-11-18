import BaseApi from "../../abstracts/BaseApi";
import {getGamesInfoData} from "../../clients/website/WebsiteClient";

export default class AllGamesApi extends BaseApi {
    restEndpoint = 'games/all'
    websocketMethod = 'all_games'

    async handle(data: any): Promise<any>
    {
        return await getGamesInfoData()
    }
}