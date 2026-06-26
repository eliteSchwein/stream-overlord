import getWebsocketServer from "../App";
import {calcProgress} from "./DataHelper";
import {logDebug} from "./LogHelper";

const timers: any[] = [];

export default function initialTimers() {
    const websocket = getWebsocketServer();

    setInterval(() => {
        for (const timerIndex in timers) {
            const timer = timers[timerIndex];

            if (!timer.active) continue;

            timer.progress = calcProgress(timer.time, timer.defaultTime);

            logDebug(
                `timer ${timer.name} defaultTime: ${timer.defaultTime} time: ${timer.time} progress: ${timer.progress}`
            );

            if (timer.time === 0) {
                websocket.send("notify_timer", {...timer, action: "finish"});
                timer.active = false;

                if (timer.callback) {
                    void timer.callback();
                }
            } else {
                websocket.send("notify_timer", {...timer, action: "update"});
                timer.time--;
            }

            timers[timerIndex] = timer;
        }
    }, 1000);
}

export function startTimer(data: any = {}) {
    const name = String(data.name ?? "").trim();
    const time = Number(data.time);
    const end = data.end ?? "blink";

    if (!name) return false;
    if (!Number.isFinite(time) || time <= 0) return false;

    const existingIndex = timers.findIndex(timer => timer.name === name);

    const timer = {
        name,
        time,
        defaultTime: time,
        active: true,
        callback: undefined,
        progress: 0,
        end: ["blink", "fade"].includes(end) ? end : "blink",
    };

    if (existingIndex >= 0) {
        timers[existingIndex] = {
            ...timers[existingIndex],
            ...timer,
        };
    } else {
        timers.push(timer);
    }

    getWebsocketServer().send("notify_timer", {
        ...timer,
        action: "start",
    });

    return true;
}

export function activateTimer(name: string) {
    const timer = timers.find(timer => timer.name === name);

    if (!timer) return false;

    if (timer.time === 0) {
        timer.time = timer.defaultTime;
    }

    timer.active = true;

    return true;
}

export function deactivateTimer(name: string) {
    const timer = timers.find(timer => timer.name === name);

    if (!timer) return false;

    timer.time = timer.defaultTime;
    timer.active = false;

    return true;
}

export function getTimers() {
    return timers;
}

export function setTimerTime(name: string, time: number) {
    const timer = timers.find(timer => timer.name === name);

    if (!timer) return false;

    timer.time = time;
    timer.defaultTime = time;

    return true;
}

export function registerTimerCallback(name: string, callback: Function) {
    const timer = timers.find(timer => timer.name === name);

    if (!timer) return false;

    timer.callback = callback;

    return true;
}