import BaseApi from "../../abstracts/BaseApi";
import {getGamesInfoData} from "../../clients/website/WebsiteClient";

export default class CurrentGameApi extends BaseApi {
    restEndpoint = 'games/current'
    websocketMethod = 'current_game'

    async handle(data: any): Promise<any>
    {
        return await getGamesInfoData()
    }
}