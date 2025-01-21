import BaseApi from "../BaseApi";
import {getGamesInfoData} from "../../../website/WebsiteClient";

export default class AllGamesApi extends BaseApi {
    endpoint = 'game/all'

    async handle(req: Request) {
        const data = await getGamesInfoData()

        return {
            status: 200,
            data: data
        }
    }
}