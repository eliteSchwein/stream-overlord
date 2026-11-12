import {logDebug, logWarn} from "./LogHelper";
import {execFile, execFileSync} from "node:child_process";
import {promisify} from "node:util";
import getWebsocketServer from "../App";

const execFileAsync = promisify(execFile);

let throttleActive = false;
let vcgencmdAvailable: boolean | undefined;
let throttleCheckInFlight = false;

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
    // One-time detection (cached); stays synchronous.
    if (!hasVcgencmd()) {
        return;
    }

    // Runs every second from the scheduler; never let checks overlap.
    if (throttleCheckInFlight) {
        return;
    }

    throttleCheckInFlight = true;

    try {
        // Async so the main thread is not blocked while vcgencmd runs.
        const {stdout: output} = await execFileAsync("vcgencmd", ["get_throttled"], {
            encoding: "utf8",
            timeout: 5_000,
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
    } finally {
        throttleCheckInFlight = false;
    }
}

export function isThrottled() {
    return throttleActive;
}