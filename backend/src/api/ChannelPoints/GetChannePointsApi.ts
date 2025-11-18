import BaseApi from "../../abstracts/BaseApi";
import {getActiveChannelPoints} from "../../helper/ChannelPointHelper";

export default class GetChannePointsApi extends BaseApi {
    restEndpoint = 'channel_points/get'
    websocketMethod = 'channel_points'

    async handle(data: any): Promise<any>
    {
        return getActiveChannelPoints()
    }
}