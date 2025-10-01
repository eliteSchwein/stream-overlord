import {execute} from "./CommandHelper";
import {getConfig} from "./ConfigHelper";
import {logRegular, logWarn} from "./LogHelper";
import {Gpio} from "onoff";
import getWebsocketServer from "../App";
import * as path from "node:path";
import * as os from "node:os";

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

export function parsePath(filePath: string) {
    if (filePath.startsWith("~")) {
        return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
}

export function getArch() {
    const realArch = process.arch

    switch (realArch) {
        case "x64":
            return "x86_64"
        case "arm64":
            return "aarch64"
        default:
            return "armv7"
    }
}

export async function rebootSystem() { await execute('shutdown -r now') }
export async function shutdownSystem() { await execute('shutdown -h now') }