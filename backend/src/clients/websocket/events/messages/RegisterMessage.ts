import BaseMessage from "./BaseMessage";
import {getRandomInt} from "../../../../../../helper/GeneralHelper";
import {logWarn} from "../../../../helper/LogHelper";

export default class RegisterMessage extends BaseMessage {
    method = 'register_endpoints'

    async handle(data: any) {
        if(!Array.isArray(data) || data.length === 0) {
            this.webSocket.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_disconnect', params: {reason: 'array of endpoints required!'}, id: getRandomInt(10_000)}))
            this.webSocket.close()

            logWarn(`client disconnected: ${this.webSocket._socket.remoteAddress}:${this.webSocket._socket.remotePort} reason: invalid registration!`)
            return
        }

        // @ts-ignore
        const invalidEndpoints = this.client.addConnection(this.webSocket, data)

        if(invalidEndpoints.length === 0) return

        this.webSocket.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_warn', params: {reason: 'invalid endpoints detected', endpoints: invalidEndpoints}, id: getRandomInt(10_000)}))
    }
}