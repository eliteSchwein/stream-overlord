import {execute} from "./CommandHelper";
import {getConfig} from "./ConfigHelper";
import {logRegular, logWarn} from "./LogHelper";
import {Gpio} from "onoff";
import getWebsocketServer from "../App";

let powerButton: any = undefined
let gpioActive = false

export function initGpio() {
    const config = getConfig(/gpio/)[0]

    if(!config) return

    gpioActive = true
    this.killGpio()

    logRegular('init gpio')

    powerButton = new Gpio(config.power_button, 'in', 'both')

    powerButton.watch((error: any, value) => {
        if (error) {
            logWarn('power button watch failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            return
        }

        if(value === 1) {
            getWebsocketServer().send('notify_power_button')
        }
    })
}

export function killGpio() {
    if(!gpioActive) return

    logRegular('clear up gpio Resources')
    if(powerButton) powerButton.unexport()
}

export async function rebootSystem() { await execute('shutdown -r now') }
export async function shutdownSystem() { await execute('shutdown -h now') }