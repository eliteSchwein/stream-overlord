import {getConfig} from "./ConfigHelper";
import getWebsocketServer from "../App";

const timers = []

export default function initialTimers() {
    const configTimers = getConfig((/^timer /g), true)

    for(const timerName in configTimers) {
        const configTimer = configTimers[timerName]
        configTimer.name = timerName
        configTimer.defaultTime = configTimer.time
        configTimer.active = false
        timers.push(configTimer)
    }

    const websocket = getWebsocketServer()

    setInterval(() => {
        for(const timerIndex in timers) {
            const timer = timers[timerIndex]

            if(!timer.active) continue

            if(timer.time === 0) {
                websocket.send('notify_timer', {...timer, action: 'finish'})
                timer.active = false
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