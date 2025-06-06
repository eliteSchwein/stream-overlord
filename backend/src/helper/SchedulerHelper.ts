import {getAdData} from "../clients/website/WebsiteClient";
import {logWarn} from "./LogHelper";
import getWebsocketServer from "../App";
import {updateSystemInfo} from "./SystemInfoHelper";
import {checkThrottle} from "./ThrottleHelper";

export default function initialSchedulers() {
    void updateAdData()

    // moderate scheduler
    setInterval(async () => {
        //await updateAdData()
    }, 15_000)

    // fast scheduler
    setInterval(async () => {
        await updateSystemInfo()
        await checkThrottle()
    }, 1_000)
}

export async function updateAdData() {
    try {
        const adData = (await getAdData(true)).ads
        getWebsocketServer().send('notify_ads', adData)
    } catch (error) {
        logWarn('ads fetch failed:')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
}