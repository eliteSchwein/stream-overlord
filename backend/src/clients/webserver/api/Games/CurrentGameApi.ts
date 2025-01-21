import BaseApi from "../BaseApi";
import {getGameInfoData} from "../../../website/WebsiteClient";

export default class CurrentGameApi extends BaseApi {
    endpoint = 'game/current'

    async handle(req: Request) {
        const data = await getGameInfoData()

        return {
            status: 200,
            data: data
        }
    }
}