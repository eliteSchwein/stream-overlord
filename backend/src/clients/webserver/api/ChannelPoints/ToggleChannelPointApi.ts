import BaseApi from "../BaseApi";
import {toggleChannelPoint} from "../../../../helper/ChannelPointHelper";

export default class ToggleChannelPointApi extends BaseApi {
    endpoint = 'channel_points/toggle'
    post = true

    async handle(req: Request) {
        const body = req.body as any

        if(!body.method) {
            return {
                error: 'method missing',
                status: 400
            }
        }

        if(!body.channel_point) {
            return {
                error: 'channel_point missing',
                status: 400
            }
        }

        const method = body.method
        const channelPoint = body.channel_point

        switch (method) {
            case 'enable':
                await toggleChannelPoint(channelPoint, false)
                break
            case 'disable':
                await toggleChannelPoint(channelPoint, true)
                break
            case 'toggle':
                await toggleChannelPoint(channelPoint, channelPoint.active)
                break
            default:
                return {
                    error: 'method invalid',
                    status: 400
                }
        }

        return {
            status: 200
        }
    }
}