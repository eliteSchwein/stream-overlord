import BaseApi from "../../abstracts/BaseApi";
import {removeAlert} from "../../helper/AlertHelper";

export default class RemoveAlertApi extends BaseApi {
    restEndpoint = 'alert/remove'
    restPost = true
    websocketMethod = 'remove_alert'

    async handle(data: any): Promise<any>
    {
        removeAlert({'event-uuid': data['event-uuid']})
    }
}