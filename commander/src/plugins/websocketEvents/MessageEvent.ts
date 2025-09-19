import BaseEvent from "@/plugins/websocketEvents/BaseEvent";
import {type Websocket, WebsocketEvent} from "websocket-ts";
import NotifyAlertQueryMessage from "@/plugins/websocketEvents/websocketMessage/NotifyAlertQueryMessage";
import NotifyGameUpdateMessage from "@/plugins/websocketEvents/websocketMessage/NotifyGameUpdateMessage";
import NotifyShieldModeMessage from "@/plugins/websocketEvents/websocketMessage/NotifyShieldModeMessage";
import NotifyChannelPointUpdateMessage
  from "@/plugins/websocketEvents/websocketMessage/NotifyChannelPointUpdateMessage";
import NotifyAudioUpdateMessage from "@/plugins/websocketEvents/websocketMessage/NotifyAudioUpdateMessage";
import NotifySystemInfoMessage from "@/plugins/websocketEvents/websocketMessage/NotifySystemInfoMessage.ts";
import NotifySceneMessage from "@/plugins/websocketEvents/websocketMessage/NotifySceneMessage.ts";
import NotifyConnectionMessage from "@/plugins/websocketEvents/websocketMessage/NotifyConnectionMessage.ts";

export default class MessageEvent extends BaseEvent {
  name = 'message'
  eventTypes = [WebsocketEvent.message]

  async handle(websocket: Websocket, event:any) {
    const data = JSON.parse(event.data)

    await new NotifyAlertQueryMessage(this.webSocketClient).handleMessage(data)
    await new NotifyGameUpdateMessage(this.webSocketClient).handleMessage(data)
    await new NotifyShieldModeMessage(this.webSocketClient).handleMessage(data)
    await new NotifyChannelPointUpdateMessage(this.webSocketClient).handleMessage(data)
    await new NotifyAudioUpdateMessage(this.webSocketClient).handleMessage(data)
    await new NotifySystemInfoMessage(this.webSocketClient).handleMessage(data)
    await new NotifySceneMessage(this.webSocketClient).handleMessage(data)
    await new NotifyConnectionMessage(this.webSocketClient).handleMessage(data)
  }
}
