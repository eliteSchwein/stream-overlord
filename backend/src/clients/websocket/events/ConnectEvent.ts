import BaseEvent from "./BaseEvent";
import {logNotice} from "../../../helper/LogHelper";
import {pushTheme} from "../../../helper/ThemeHelper";
import AdMessage from "./messages/AdMessage";
import {sleep} from "../../../../../helper/GeneralHelper";
import EditColorMessage from "./messages/EditColorMessage";

export default class ConnectEvent extends BaseEvent{
    name = 'connect'
    eventTypes = ['connection']

    async handle(event:any) {
        logNotice(`new client connected: ${event._socket.remoteAddress}:${event._socket.remotePort}`)

        event.on('message', async (message) => {
            const data = JSON.parse(`${message}`);

            await new AdMessage(this.webSocketServer, event).handleMessage(data)
            await new EditColorMessage(this.webSocketServer, event).handleMessage(data)
        })

        await sleep(500)

        pushTheme()
    }
}