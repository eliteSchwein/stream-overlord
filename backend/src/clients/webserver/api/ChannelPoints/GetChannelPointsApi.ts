import BaseApi from "../BaseApi";
import {getActiveChannelPoints} from "../../../../helper/ChannelPointHelper";

export default class GetChannelPointsApi extends BaseApi {
    endpoint = 'channel_points/get'

    async handle(req: Request) {
        const data = getActiveChannelPoints()

        return {
            status: 200,
            data: data
        }
    }
}