import BaseMessage from "./BaseMessage";

export default class DisconnectConnectionMessage extends BaseMessage {
    method = 'disconnect_connection'

    async handle(data: any) {
        this.client.disconnectConnection(data.client)
    }
}