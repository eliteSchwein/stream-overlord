import BaseEvent from "@/plugins/websocketEvents/BaseEvent";
import {type Websocket, WebsocketEvent} from "websocket-ts";

export default class ConnectEvent extends BaseEvent {
  name = 'connect'
  eventTypes = [WebsocketEvent.open, WebsocketEvent.reconnect]

  async handle(websocket: Websocket, event:any) {
    this.store.setWebsocketConnected(true)
    this.store.setWebsocketConnecting(false)
    console.log('Connected to Websocket')
  }
}
