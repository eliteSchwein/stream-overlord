import BaseApi from "../../abstracts/BaseApi";
import {toggleChannelPointPause} from "../../helper/ChannelPointHelper";

export default class ToggleChannelPointApi extends BaseApi {
    restEndpoint = 'channel_points/toggle'
    restPost = true
    websocketMethod = 'toggle_channel_point'

    async handle(data: any): Promise<any>
    {
        if(!data.state) {
            return {"error": "missing state"}
        }
        if(!data.channel_point || !data.channel_point.name) {
            return {"error": "missing channel point"}
        }

        const state = data.state
        const channelPoint = data.channel_point

        switch (state) {
            case 'enable':
            case 'true':
                await toggleChannelPointPause(channelPoint, false)
                break
            case 'disable':
            case 'false':
                await toggleChannelPointPause(channelPoint, true)
                break
            case 'toggle':
                await toggleChannelPointPause(channelPoint, channelPoint.active)
                break
            default:
                return {"error": "invalid state"}
        }
    }
}