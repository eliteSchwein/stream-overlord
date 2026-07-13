import {logDebug, logWarn} from "./LogHelper";
import {execFileSync} from "node:child_process";
import getWebsocketServer from "../App";

let throttleActive = false;
let vcgencmdAvailable: boolean | undefined;

const UNDERVOLTED = 0x1;
const CAPPED = 0x2;
const THROTTLED = 0x4;

function hasVcgencmd(): boolean {
    if (vcgencmdAvailable !== undefined) {
        return vcgencmdAvailable;
    }

    try {
        execFileSync("sh", ["-c", "command -v vcgencmd"], {
            stdio: "ignore"
        });

        vcgencmdAvailable = true;
        logDebug("vcgencmd detected, Raspberry Pi throttle protection enabled");
    } catch {
        vcgencmdAvailable = false;
        logDebug("vcgencmd not found, Raspberry Pi throttle protection disabled");
    }

    return vcgencmdAvailable;
}

export async function checkThrottle() {
    if (!hasVcgencmd()) {
        return;
    }

    try {
        const output = execFileSync("vcgencmd", ["get_throttled"], {
            encoding: "utf8"
        });

        const hexString = output.split("=")[1]?.trim();

        if (!hexString) {
            throw new Error(`Unexpected vcgencmd output: ${output.trim()}`);
        }

        const status = Number.parseInt(hexString, 16);

        if (Number.isNaN(status)) {
            throw new Error(`Invalid throttle status: ${hexString}`);
        }

        const isThrottled = (status & THROTTLED) !== 0;
        const isCapped = (status & CAPPED) !== 0;
        const isUndervolted = (status & UNDERVOLTED) !== 0;

        throttleActive = isThrottled || isCapped || isUndervolted;

        if (throttleActive) {
            logWarn(`Throttle status: 0x${status.toString(16)}`);
            logWarn(
                `throttleActive: ${isThrottled}, cappedActive: ${isCapped}, undervoltedActive: ${isUndervolted}`
            );
        }

        getWebsocketServer().send("notify_throttle", throttleActive);
    } catch (error) {
        logDebug("throttle update failed:");
        logDebug(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export function isThrottled() {
    return throttleActive;
}