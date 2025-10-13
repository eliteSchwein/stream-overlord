import {logDebug, logWarn} from "./LogHelper";
import {getConfig} from "./ConfigHelper";
import {execSync} from "child_process";
import getWebsocketServer from "../App";

let throttleActive = false;

const UNDERVOLTED = 0x1;
const CAPPED = 0x2;
const THROTTLED = 0x4;
const HAS_UNDERVOLTED = 0x10000;
const HAS_CAPPED = 0x20000;
const HAS_THROTTLED = 0x40000;

export async function checkThrottle() {
    try {
        const config = Object.assign({}, getConfig(/throttle_protection/g)[0]);

        if (!config.enable_rpi) return;

        const output = execSync('vcgencmd get_throttled').toString();
        const hexString = output.split('=')[1].trim();
        const status = parseInt(hexString, 16);

        const isThrottled = (status & THROTTLED) !== 0;
        const isCapped = (status & CAPPED) !== 0;
        const isUndervolted = (status & UNDERVOLTED) !== 0;

        throttleActive = false

        throttleActive = isThrottled || isCapped || isUndervolted;

        if(throttleActive) {
            logWarn(`Throttle status: 0x${status.toString(16)}`);
            logWarn(`throttleActive: ${isThrottled}, cappedActive: ${isCapped}, undervoltedActive: ${isUndervolted}`);
        }

        const websocket = getWebsocketServer()

        websocket.send('notify_throttle', throttleActive)
    } catch (error) {
        logDebug('throttle update failed:');
        logDebug(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export function isThrottled() {
    return throttleActive
}