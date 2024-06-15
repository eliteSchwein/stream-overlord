import BaseEvent from "./BaseEvent";
import {logNotice} from "../../../helper/LogHelper";
import {pushTheme} from "../../../helper/ThemeHelper";

export default class ConnectEvent extends BaseEvent{
    name = 'connect'
    eventTypes = ['connection']

    async handle(event:any) {
        logNotice(`new client connected: ${event._socket.remoteAddress}:${event._socket.remotePort}`)

        pushTheme()
    }
}