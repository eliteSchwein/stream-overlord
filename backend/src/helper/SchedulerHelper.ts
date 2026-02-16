import {getAdData} from "../clients/website/WebsiteClient";
import {logWarn} from "./LogHelper";
import getWebsocketServer, {getTauonmbClient, getYoloboxClient} from "../App";
import {updateSystemComponents, updateSystemInfo} from "./SystemInfoHelper";
import {checkThrottle} from "./ThrottleHelper";
import {fetchVoices} from "./TTShelper";
import {updateAutoMacros} from "./AutoMacroHelper";
import {updateTemplateVariables} from "./TemplateHelper";
import {updateGiveaway} from "./GiveawayHelper";
import {pulseHeartbeatLeds} from "./NeopixelHelper";

export default function initialSchedulers() {
    void updateAdData()

    // slowest scheduler (1h)
    setInterval(async () => {
        await fetchVoices()
    }, 3_600_000)

    // slow scheduler (1 min)
    setInterval(async () => {
    }, 60_000)

    // moderate scheduler (15 sec)
    setInterval(async () => {
        updateTemplateVariables()
    }, 15_000)

    // fast scheduler (1 sec)
    setInterval(async () => {
        void updateSystemInfo()
        void checkThrottle()
        void updateSystemComponents()
        void updateAutoMacros()
        void updateGiveaway()
        void pulseHeartbeatLeds()
    }, 1_000)

    // faster scheduler (500 ms)
    setInterval(async () => {
        void getYoloboxClient()?.checkConnection()
    }, 500)

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