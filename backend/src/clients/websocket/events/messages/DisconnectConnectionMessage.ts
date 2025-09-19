import BaseMessage from "./BaseMessage";
import {removeEventFromQuery} from "../../../twitch/helper/CooldownHelper";

export default class DisconnectConnectionMessage extends BaseMessage {
    method = 'disconnect_connection'

    async handle(data: any) {
        this.client.disconnectConnection(data.client)
    }
}