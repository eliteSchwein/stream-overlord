import BaseEvent from "./BaseEvent";
import {logDebug, logNotice, logWarn} from "../../../helper/LogHelper";
import AdMessage from "./messages/AdMessage";
import {getRandomInt, sleep} from "../../../../../helper/GeneralHelper";
import EditColorMessage from "./messages/EditColorMessage";
import RemoveEventMessage from "./messages/RemoveEventMessage";
import GetEffectMessage from "./messages/GetEffectMessage";
import RemoveAlertMessage from "./messages/RemoveAlertMessage";
import SetVolumeMessage from "./messages/SetVolumeMessage";
import PlaySoundMessage from "./messages/PlaySoundMessage";
import RefreshSourceMessage from "./messages/RefreshSourceMessage";
import SaveSourceMessage from "./messages/SaveSourceMessage";
import RegisterMessage from "./messages/RegisterMessage";
import DisconnectConnectionMessage from "./messages/DisconnectConnectionMessage";
import UpdateConfigMessage from "./messages/UpdateConfigMessage";
import ToggleTestModeMessage from "./messages/ToggleTestModeMessage";
import HaltSystemMessage from "./messages/HaltSystemMessage";
import UpdateMessage from "./messages/UpdateMessage";
import ToggleAutoMacroMessage from "./messages/ToggleAutoMacroMessage";
import StartGiveawayMessage from "./messages/StartGiveawayMessage";
import StopGiveawayMessage from "./messages/StopGiveawayMessage";
import RemoveGiveawayUserMessage from "./messages/RemoveGiveawayUserMessage";
import {getUnreadyMessage, isBackendReady} from "../../../App";

export default class ConnectEvent extends BaseEvent{
    name = 'connect'
    eventTypes = ['connection']

    async handle(event: any) {
        const client = `${event._socket.remoteAddress}:${event._socket.remotePort}`

        if(!isBackendReady()) {
            await sleep(25)
            event.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_disconnect', params: {reason: getUnreadyMessage()}, id: getRandomInt(10_000)}))
            event.close()
            logDebug(`connection denied, backend not ready: ${client}`)
            return
        }

        logNotice(`new client connected: ${client}`)

        event.on('message', async (message: any) => {
            try {
                const data = JSON.parse(`${message}`);

                await new RegisterMessage(this.webSocketServer, event, this.client).handleMessage(data)
                await new DisconnectConnectionMessage(this.webSocketServer, event, this.client).handleMessage(data)

                for(const websocketMessage of this.client.getMessageEvents()) {
                    if(websocketMessage.getWebsocketMethod() !== data.method) continue

                    await websocketMessage.handleWebsocketEvent(event, data)
                }
            } catch (error) {
                logWarn('websocket message failed:')
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
        })

        event.on("close", (code, reason) => {
            logDebug(`client disconnected: ${client} code: ${code} reason: ${reason.toString()}`)

            this.client.removeConnection(client)
        });

        await sleep(1_000)

        if(event.readyState === WebSocket.CLOSED) return

        if(!this.client.isConnectionRegistered(client)) {
            await sleep(25)
            event.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_disconnect', params: {reason: 'not registered in time!'}, id: getRandomInt(10_000)}))
            event.close()

            logWarn(`client disconnected: ${client} reason: not registered in time!`)
            return
        }
    }
}