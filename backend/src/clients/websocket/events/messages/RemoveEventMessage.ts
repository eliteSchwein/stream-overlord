import BaseMessage from "./BaseMessage";
import {removeEventFromQuery} from "../../../twitch/helper/CooldownHelper";

export default class RemoveEventMessage extends BaseMessage {
    method = 'remove_event'

    async handle(data: any) {
        removeEventFromQuery(data['event-uuid'])
    }
}