import {getAdData} from "../clients/website/WebsiteClient";
import {logWarn} from "./LogHelper";
import getWebsocketServer, {getTauonmbClient} from "../App";
import {updateSystemInfo} from "./SystemInfoHelper";
import {checkThrottle} from "./ThrottleHelper";
import {fetchVoices} from "./TTShelper";

export default function initialSchedulers() {
    void updateAdData()

    // slow scheduler (1h)
    setInterval(async () => {
        await fetchVoices()
    }, 3_600_000)

    // moderate scheduler (15 sec)
    setInterval(async () => {
        //await updateAdData()
    }, 15_000)

    // fast scheduler (1 sec)
    setInterval(async () => {
        await updateSystemInfo()
        await checkThrottle()
    }, 1_000)

    // fastest scheduler (250 ms)
    setInterval(() => {
        void getTauonmbClient()?.sync()
    }, 250)
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