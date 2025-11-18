import BaseApi from "../../abstracts/BaseApi";
import {removeEventFromQuery} from "../../clients/twitch/helper/CooldownHelper";

export default class RemoveEventApi extends BaseApi {
    restEndpoint = 'recovery/remove_event'
    restPost = true
    websocketMethod = 'remove_event'

    async handle(data: any): Promise<any>
    {
        removeEventFromQuery(data['event-uuid'])
    }
}