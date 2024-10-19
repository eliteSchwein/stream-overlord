import BaseEvent from "./BaseEvent";
import {logNotice} from "../../../helper/LogHelper";
import {pushTheme} from "../../../helper/ThemeHelper";
import AdMessage from "./messages/AdMessage";
import {sleep} from "../../../../../helper/GeneralHelper";
import EditColorMessage from "./messages/EditColorMessage";
import ClearEventMessage from "./messages/ClearEventMessage";
import GetEffectMessage from "./messages/GetEffectMessage";
import GetShieldMessage from "./messages/GetShieldMessage";
import isShieldActive from "../../../helper/ShieldHelper";

export default class ConnectEvent extends BaseEvent{
    name = 'connect'
    eventTypes = ['connection']

    async handle(event:any) {
        logNotice(`new client connected: ${event._socket.remoteAddress}:${event._socket.remotePort}`)

        event.on('message', async (message: any) => {
            const data = JSON.parse(`${message}`);

            await new AdMessage(this.webSocketServer, event).handleMessage(data)
            await new EditColorMessage(this.webSocketServer, event).handleMessage(data)
            await new ClearEventMessage(this.webSocketServer, event).handleMessage(data)
            await new GetEffectMessage(this.webSocketServer, event).handleMessage(data)
            await new GetShieldMessage(this.webSocketServer, event).handleMessage(data)
        })

        await sleep(500)

        pushTheme(event)
        event.send(JSON.stringify({method: 'shield_mode', data: {status: isShieldActive()}}))
    }
}