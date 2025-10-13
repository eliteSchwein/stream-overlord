import BaseMessage from "./BaseMessage";
import {removeAlert} from "../../../../helper/AlertHelper";

export default class RemoveAlertMessage extends BaseMessage {
    method = 'remove_alert'

    async handle(data: any) {
        removeAlert({'event-uuid': data['event-uuid']})
    }
}