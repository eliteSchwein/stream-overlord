import {getConfig} from "./ConfigHelper";
import getWebsocketServer from "../App";
import {calcProgress} from "./DataHelper";
import {logDebug} from "./LogHelper";

const timers = []

export default function initialTimers() {
    const configTimers = getConfig((/^timer /g), true)

    for(const timerName in configTimers) {
        const configTimer = configTimers[timerName]
        configTimer.name = timerName
        configTimer.defaultTime = configTimer.time
        configTimer.active = false
        configTimer.callback = undefined
        configTimer.progress = 0
        timers.push(configTimer)
    }

    const websocket = getWebsocketServer()

    setInterval(() => {
        for(const timerIndex in timers) {
            const timer = timers[timerIndex]

            if(!timer.active) continue

            timer.progress = calcProgress(timer.time, timer.defaultTime)

            logDebug(`timer ${timer.name} defaultTime: ${timer.defaultTime} time: ${timer.time} progress: ${timer.progress}`)

            if(timer.time === 0) {
                websocket.send('notify_timer', {...timer, action: 'finish'})
                timer.active = false
                if(timer.callback) {
                    void timer.callback()
                }
            } else {
                websocket.send('notify_timer', {...timer, action: 'update'})
                timer.time--
            }

            timers[timerIndex] = timer
        }
    }, 1000)
}

export function activateTimer(name: string) {
    for(const timerIndex in timers) {
        const timer = timers[timerIndex]

        if(timer.name !== name) continue

        if(timer.time === 0) {
            timer.time = timer.defaultTime
        }

        timer.active = true

        timers[timerIndex] = timer
    }
}

export function deactivateTimer(name: string) {
    for(const timerIndex in timers) {
        const timer = timers[timerIndex]

        if(timer.name !== name) continue

        timer.time = timer.defaultTime

        timer.active = false

        timers[timerIndex] = timer
    }
}

export function getTimers() { return timers }

export function setTimerTime(name: string, time: number) {
    for(const timerIndex in timers) {
        const timer = timers[timerIndex]

        if(timer.name !== name) continue

        timer.time = time
        timer.defaultTime = time
        timers[timerIndex] = timer
    }
}

export function registerTimerCallback(name: string, callback: Function) {
    for(const timerIndex in timers) {
        const timer = timers[timerIndex]

        if(timer.name !== name) continue

        timer.callback = callback
        timers[timerIndex] = timer
    }
}