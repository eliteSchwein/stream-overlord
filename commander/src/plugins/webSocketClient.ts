import {Websocket} from "websocket-ts";
import {getRandomInt} from "@/helper/GeneralHelper";

export class WebsocketClient {
  url = ''
  websocket: Websocket
  reconnectInterval = 1_000

  public constructor(
    url: string,
  ) {
    this.url = url
  }

  public setUrl(url: string) {
    this.url = url;
  }

  public async connect(): Promise<void> {
    this.websocket = new Websocket(this.url);
  }

  public getWebsocket() {
    return this.websocket;
  }

  private registerEvents() {

  }

  public send(method: string, data: any = {}) {
    try {
      this.websocket.send(JSON.stringify({jsonrpc: "2.0", method: method, params: data, id: getRandomInt(10_000)}))
    } catch (error) {
      console.error('request to a websocket client failed!')
      console.error(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
  }
}
