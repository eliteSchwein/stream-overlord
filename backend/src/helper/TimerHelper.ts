import {getConfig} from "./ConfigHelper";

const timers = []

export default function initialTimers() {
    const configTImers = getConfig((/^timer /g), true)
    console.log(configTImers)

    for(const timerName in configTImers) {
        const configTimer = configTImers[timerName]
        configTimer.name = timerName
        configTimer.defaultTime = configTimer.time
        configTimer.active = false
        console.log(configTimer)
        timers.push(configTimer)
    }
}