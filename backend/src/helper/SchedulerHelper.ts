import {getAdData} from "../clients/website/WebsiteClient";
import {logWarn} from "./LogHelper";
import getWebsocketServer from "../App";

export default function initialSchedulers() {

    // moderate scheduler
    setInterval(async () => {
        const webSocketServer = getWebsocketServer()
        try {
            const adData = (await getAdData()).ads
            webSocketServer.send('ad_result', adData)
        } catch (error) {
            logWarn('ads fetch failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }, 15_000)
}