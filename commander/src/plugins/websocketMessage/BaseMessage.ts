import type {WebsocketClient} from "@/plugins/webSocketClient";
import {getRandomInt} from "@/helper/GeneralHelper";

export default class BaseMessage {
  webSocket: WebsocketClient
  method: string
  id: number = getRandomInt(10_000)

  public constructor(webSocket: WebsocketClient) {
    this.webSocket = webSocket
  }

  public async handleMessage(data: any) {
    if(data.method !== this.method) { return }
    if(data.id) {
      this.id = data.id
    }

    await this.handle(data.data)
  }


  public send(method: string, data: any = {}) {
    this.webSocket.send(method, data)
  }

  async handle(data: any) {

  }
}
