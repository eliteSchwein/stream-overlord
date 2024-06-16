import {getConfig} from "../../helper/ConfigHelper";
import OBSWebSocket, {EventSubscription} from "obs-websocket-js";

export class OBSClient {
    obsWebsocket: OBSWebSocket

    public async connect() {
        const config = getConfig(/obs/g)[0]

        this.obsWebsocket = new OBSWebSocket()
        await this.obsWebsocket.connect(`ws://${config.ip}:${config.port}`, config.password, {
            eventSubscriptions: EventSubscription.All
        })
    }

    public getOBSWebSocket() {
        return this.obsWebsocket
    }
}