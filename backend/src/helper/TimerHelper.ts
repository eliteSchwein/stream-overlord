import getWebsocketServer from "../App";
import {calcProgress} from "./DataHelper";
import {logDebug, logWarn} from "./LogHelper";

const timers: any[] = [];

function getPublicTimerData(timer: any = {}) {
    const {callback, ...publicTimer} = timer;
    return publicTimer;
}

async function triggerFinishedMacro(timer: any) {
    const finishedMacro = String(timer.finished_macro ?? "").trim();

    if (!finishedMacro) return;

    try {
        const {triggerMacro} = await import("./MacroHelper");

        await triggerMacro(finishedMacro, {
            timer: {
                name: timer.name,
                time: timer.time,
                defaultTime: timer.defaultTime,
                progress: timer.progress,
                end: timer.end,
                finished_macro: finishedMacro,
            },
        });
    } catch (error) {
        logWarn(`failed to trigger finished timer macro ${finishedMacro}`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

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
                websocket.send("notify_timer", {...getPublicTimerData(timer), action: "finish"});
                timer.active = false;

                void triggerFinishedMacro(timer);

                if (timer.callback) {
                    void timer.callback();
                }
            } else {
                websocket.send("notify_timer", {...getPublicTimerData(timer), action: "update"});
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
    const finishedMacro = String(data.finished_macro ?? "").trim();

    if (!name) return false;
    if (!Number.isFinite(time) || time <= 0) return false;

    const existingIndex = timers.findIndex(timer => timer.name === name);

    const timer = {
        name,
        time,
        defaultTime: time,
        active: true,
        callback: data.callback,
        progress: 0,
        end: ["blink", "fade"].includes(end) ? end : "blink",
        finished_macro: finishedMacro || undefined,
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
        ...getPublicTimerData(timer),
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
    return timers.map(getPublicTimerData);
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
