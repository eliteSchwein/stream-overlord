import BaseEvent from "./BaseEvent";
import {logNotice} from "../../../helper/LogHelper";
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

export default class ConnectEvent extends BaseEvent{
    name = 'connect'
    eventTypes = ['connection']

    async handle(event:any) {
        logNotice(`new client connected: ${event._socket.remoteAddress}:${event._socket.remotePort}`)

        event.on('message', async (message: any) => {
            const data = JSON.parse(`${message}`);

            await new AdMessage(this.webSocketServer, event).handleMessage(data)
            await new EditColorMessage(this.webSocketServer, event).handleMessage(data)
            await new RemoveEventMessage(this.webSocketServer, event).handleMessage(data)
            await new GetEffectMessage(this.webSocketServer, event).handleMessage(data)
            await new RemoveAlertMessage(this.webSocketServer, event).handleMessage(data)
            await new SetVolumeMessage(this.webSocketServer, event).handleMessage(data)
            await new PlaySoundMessage(this.webSocketServer, event).handleMessage(data)
            await new RefreshSourceMessage(this.webSocketServer, event).handleMessage(data)
            await new SaveSourceMessage(this.webSocketServer, event).handleMessage(data)
        })

        event.on("close", (code, reason) => {
            console.log("[WS] Client disconnected", { code, reason: reason.toString() });
        });

        await sleep(500)

        //pushGameInfo(event)

        event.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_shield_mode', params: {action: isShieldActive()? 'enable' : 'disable'}, id: getRandomInt(10_000)}))
        event.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_channel_point_update', params: getActiveChannelPoints(), id: getRandomInt(10_000)}))
        event.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_audio_update', params: getAudioData(), id: getRandomInt(10_000)}))
        event.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_system_info', params: getSystemInfo(), id: getRandomInt(10_000)}))
        event.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_source_update', params: getSourceFilters(), id: getRandomInt(10_000)}))
        event.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_tauonmb_update', params: getTauonmbClient()?.getStatus(), id: getRandomInt(10_000)}))
    }
}