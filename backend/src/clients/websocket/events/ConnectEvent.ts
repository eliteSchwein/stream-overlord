import BaseEvent from "./BaseEvent";
import {logDebug, logNotice, logWarn} from "../../../helper/LogHelper";
import {pushGameInfo} from "../../../helper/GameHelper";
import AdMessage from "./messages/AdMessage";
import {getRandomInt, sleep} from "../../../../../helper/GeneralHelper";
import EditColorMessage from "./messages/EditColorMessage";
import RemoveEventMessage from "./messages/RemoveEventMessage";
import GetEffectMessage from "./messages/GetEffectMessage";
import isShieldActive from "../../../helper/ShieldHelper";
import RemoveAlertMessage from "./messages/RemoveAlertMessage";
import {getActiveChannelPoints} from "../../../helper/ChannelPointHelper";
import {getAudioData} from "../../../helper/AudioHelper";
import SetVolumeMessage from "./messages/SetVolumeMessage";
import PlaySoundMessage from "./messages/PlaySoundMessage";
import {getSystemInfo} from "../../../helper/SystemInfoHelper";
import {getSourceFilters} from "../../../helper/SourceHelper";
import RefreshSourceMessage from "./messages/RefreshSourceMessage";
import SaveSourceMessage from "./messages/SaveSourceMessage";
import {getTauonmbClient} from "../../../App";
import RegisterMessage from "./messages/RegisterMessage";
import DisconnectConnectionMessage from "./messages/DisconnectConnectionMessage";

export default class ConnectEvent extends BaseEvent{
    name = 'connect'
    eventTypes = ['connection']

    async handle(event: any) {
        logNotice(`new client connected: ${event._socket.remoteAddress}:${event._socket.remotePort}`)
        logDebug(`current connections: ${this.webSocketServer.clients.size}`);

        const client = `${event._socket.remoteAddress}:${event._socket.remotePort}`

        event.on('message', async (message: any) => {
            const data = JSON.parse(`${message}`);

            await new RegisterMessage(this.webSocketServer, event, this.client).handleMessage(data)

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
        })

        event.on("close", (code, reason) => {
            logDebug(`client disconnected: ${client} code: ${code} reason: ${reason.toString()}`)

            logWarn(`current connections: ${this.webSocketServer.clients.size}`);

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