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

export default class ConnectEvent extends BaseEvent{
    name = 'connect'
    eventTypes = ['connection']

    async handle(event: any) {
        logNotice(`new client connected: ${event._socket.remoteAddress}:${event._socket.remotePort}`)

        const client = `${event._socket.remoteAddress}:${event._socket.remotePort}`

        event.on('message', async (message: any) => {
            const data = JSON.parse(`${message}`);

            await new RegisterMessage(this.webSocketServer, event, this.client).handleMessage(data)

            await new ToggleAutoMacroMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new AdMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new EditColorMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new RemoveEventMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new GetEffectMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new RemoveAlertMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new SetVolumeMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new PlaySoundMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new RefreshSourceMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new SaveSourceMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new DisconnectConnectionMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new UpdateConfigMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new ToggleTestModeMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new HaltSystemMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new UpdateMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new StartGiveawayMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new StopGiveawayMessage(this.webSocketServer, event, this.client).handleMessage(data)
            await new RemoveGiveawayUserMessage(this.webSocketServer, event, this.client).handleMessage(data)

            for(const websocketMessage of this.client.getMessageEvents()) {
                if(websocketMessage.getWebsocketMethod() !== data.method) continue

                await websocketMessage.handleWebsocketEvent(data)
            }
        })

        event.on("close", (code, reason) => {
            logDebug(`client disconnected: ${client} code: ${code} reason: ${reason.toString()}`)

            this.client.removeConnection(client)
        });

        await sleep(1_000)

        if(event.readyState === WebSocket.CLOSED) return

        if(!this.client.isConnectionRegistered(client)) {
            event.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_disconnect', params: {reason: 'not registered in time!'}, id: getRandomInt(10_000)}))
            event.close()

            logWarn(`client disconnected: ${client} reason: not registered in time!`)
            return
        }
    }
}