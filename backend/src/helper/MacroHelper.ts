import {getAssetConfig, getConfig, getPrimaryChannel} from "./ConfigHelper";
import getWebsocketServer, {getOBSClient, getTwitchClient, getYoloboxClient} from "../App";
import {logNotice, logRegular, logWarn} from "./LogHelper";
import {sleep} from "../../../helper/GeneralHelper";
import {parsePlaceholders} from "./DataHelper";
import fillTemplate, {getTemplateVariables} from "./TemplateHelper";
import {colorNeopixel} from "./NeopixelHelper";
import {toggleAutoMacro} from "./AutoMacroHelper";
import {calculateTTSduration, speak} from "./TTShelper";
import {addAlert} from "./AlertHelper";
import {v4 as uuidv4} from "uuid";
import {
    addSongRequest,
    back as musicBack,
    next as musicNext,
    pause as musicPause,
    play as musicPlay,
    playSong as musicPlaySong,
    reloadMusicPlayer,
    setMusicLoop,
    setMusicLoopFile,
    setMusicShuffle,
    setRelativeVolume as musicSetRelativeVolume,
    setVolume as musicSetVolume,
    stopMusicPlayback,
    toggleMusicLoop,
    toggleMusicLoopFile,
    toggleMusicShuffle, togglePause,
    toggleSongRequest,
} from "./MusicHelper";

let macros: any = {};

const cancelledEvents = new Set<string>()

export function cancelMacroEvent(eventUuid: string | undefined) {
    if (!eventUuid) return
    cancelledEvents.add(eventUuid)
}

export function clearCancelledMacroEvent(eventUuid: string | undefined) {
    if (!eventUuid) return
    cancelledEvents.delete(eventUuid)
}

function isMacroEventCancelled(variables: any) {
    return variables?.eventUuid && cancelledEvents.has(variables.eventUuid)
}

export default function loadMacros() {
    logRegular("load macros");
    macros = {};

    const config = getConfig(/^macro /g, true);

    for (const macroName in config) {
        macros[macroName] = config[macroName];
    }

    getWebsocketServer().send("notify_macro_update", {macros});
}

export function getMacros() {
    return macros;
}

export function isMacroPresent(name: string) {
    return macros[name] !== undefined;
}

function getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function interpolateTemplate(input: string, variables: any): string {
    return input.replace(/\$\{([^}]+)\}/g, (_, path) => {
        const value = getNestedValue(variables, path.trim());

        if (value === undefined || value === null) {
            return "";
        }

        if (typeof value === "object") {
            return JSON.stringify(value);
        }

        return String(value);
    });
}

function evaluateCheck(value: any, check: string = ""): boolean {
    try {
        return Boolean(Function("value", `return value ${check}`)(value));
    } catch (error) {
        logWarn(`invalid macro condition: value ${check}`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return false;
    }
}

function shouldExecute(controlStack: any[]): boolean {
    return controlStack.every(block => block.active);
}

function parentsShouldExecute(controlStack: any[]): boolean {
    return controlStack.slice(0, -1).every(block => block.active);
}

export async function triggerMacro(name: string, variables: any = {}) {
    if (!macros[name]) {
        return false;
    }

    if (!variables) variables = {};

    variables = {
        ...getTemplateVariables(),
        ...variables,
    };

    const macroApis = macros[name]?.apis ?? [];

    for (const macroApi of macroApis) {
        const regex = new RegExp(`api ${macroApi}`, "g");
        const apiConfig = getConfig(regex)[0];

        if (apiConfig?.url) {
            variables = {
                ...variables,
                api: {
                    ...(variables.api || {}),
                    [macroApi]: await (await fetch(apiConfig.url)).json(),
                },
            };
        }
    }

    const tasks = macros[name]?.tasks ?? [];

    logNotice(`trigger ${tasks.length} tasks from ${name} macro`);

    const controlStack: any[] = [];

    for (const preTask of tasks) {
        if (isMacroEventCancelled(variables)) {
            logWarn(`macro ${name} cancelled for event ${variables.eventUuid}`)
            return false
        }

        try {
            const taskString = JSON.stringify(preTask);
            const interpolated = interpolateTemplate(taskString, variables);
            const task = JSON.parse(interpolated);

            if (task.channel === "condition") {
                logRegular(`test condition: ${task.method} ${task.check ?? ''}`);

                switch (task.method) {
                    case "if": {
                        const active =
                            shouldExecute(controlStack) &&
                            evaluateCondition(task.check, variables);

                        controlStack.push({
                            active,
                            branchTaken: active,
                        });

                        continue;
                    }

                    case "else_if": {
                        const block = controlStack[controlStack.length - 1];

                        if (!block) continue;

                        const parentActive = parentsShouldExecute(controlStack);

                        if (!parentActive || block.branchTaken) {
                            block.active = false;
                        } else {
                            const active = evaluateCondition(task.check, variables);

                            block.active = active;
                            block.branchTaken = active;
                        }

                        continue;
                    }

                    case "else": {
                        const block = controlStack[controlStack.length - 1];

                        if (!block) continue;

                        const parentActive = parentsShouldExecute(controlStack);

                        block.active = parentActive && !block.branchTaken;
                        block.branchTaken = true;

                        continue;
                    }

                    case "end_if": {
                        controlStack.pop();
                        continue;
                    }

                    case "end_macro": {
                        if (shouldExecute(controlStack)) {
                            return true;
                        }

                        continue;
                    }
                }
            }

            if (!shouldExecute(controlStack)) {
                continue;
            }

            switch (task.channel) {
                case "obs": {
                    await handleObs(task.method, task.data);
                    break;
                }

                case "rest": {
                    await handleRest(task.method, task.endpoint, task.data);
                    break;
                }

                case "websocket": {
                    handleWebsocket(task.method, task.data);
                    break;
                }

                case "function": {
                    await handleFunction(task.method, task.data, variables);
                    break;
                }

                case "music": {
                    await handleMusic(task.method, task.data);
                    break;
                }

                case "macro": {
                    await triggerMacro(task.method, variables);
                    break;
                }

                case "webhook": {
                    await handleWebhook(task.method, task.data);
                    break;
                }

                case "yolobox": {
                    await handleYolobox(task.method, task.data);
                    break;
                }

                case "neopixel": {
                    await handleNeopixel(task.method, task.data);
                    break;
                }

                case "alert": {
                    task.eventUuid = variables.eventUuid;
                    await handleAlert(task.message, task.asset, task.eventUuid, variables);
                    break;
                }

                case "dummy_alert": {
                    await handleDummyAlert(task, variables);
                    break;
                }

                case "channel_point": {
                    await handleChannelPoint(task.method, variables.event);
                    break;
                }

                case "effect": {
                    handleEffect(task.method, task.data)
                    break
                }

                case "animation": {
                    handleAnimation(task.method, task.data)
                    break
                }
            }
        } catch (error) {
            logWarn(`task failed:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    return true;
}

async function handleDummyAlert(task: any, variables: any) {
    if (!task.message) {
        logWarn(`dummy_alert requires message`);
        return;
    }

    const eventUuid =
        task.event_uuid ??
        task.eventUuid ??
        variables.eventUuid ??
        `macro_${uuidv4()}`;

    const duration =
        task.duration === "tts"
            ? calculateTTSduration(task.message)
            : task.duration ?? 5;

    addAlert({
        dummy: true,
        duration: duration,
        icon: task.icon ?? "",
        message: task.message,
        "event-uuid": eventUuid,
        speak: task.speak ?? false,
    });
}

async function handleYolobox(method: string, data: any = {}) {
    logRegular(`send yolobox command: ${method}`);

    const yoloboxClient = getYoloboxClient();
    const yoloboxData = yoloboxClient?.getData();

    if (!yoloboxClient || !yoloboxData) {
        logWarn(`yolobox is currently not connected`);
        return;
    }

    if (method === "order_material_change") {
        const materialList = Array.isArray(yoloboxData.MaterialList)
            ? yoloboxData.MaterialList
            : [];

        if (!Array.isArray(yoloboxData.MaterialList)) {
            logWarn(`yolobox MaterialList is missing or invalid - skipping material change`);
            return;
        }

        for (const material of materialList) {
            if (data.id === "all" && material.isSelected !== data.isSelected) {
                yoloboxClient.sendCommand({
                    data: {
                        id: material.id,
                        isSelected: data.isSelected,
                    },
                    orderID: "order_material_change",
                });
            }

            if (material.id !== data.id) continue;
            if (material.isSelected === data.isSelected) return;
        }
    }

    if (data.id === "all") return;

    yoloboxClient.sendCommand({
        data,
        orderID: method,
    });
}

async function handleAlert(
    message: string,
    asset: string,
    eventUuid: string | undefined = undefined,
    variables: any = {},
) {
    const theme = getAssetConfig(asset);

    if (!theme) {
        logWarn(`no theme found for ${asset}`);
        return;
    }

    if (!message) {
        logWarn(`no message provided`);
        return;
    }

    if (!eventUuid) {
        eventUuid = `macro_${uuidv4()}`;
    }

    addAlert({
        asset,
        sound: theme.sound,
        duration: theme.duration ?? 15,
        color: theme.color,
        icon: theme.icon,
        message,
        "event-uuid": eventUuid,
        video: theme.video,
        lamp_color: theme.lamp_color,
        volume: theme.volume,
        image: theme.image,
        channel: theme.channel,
        start_macros: theme.start_macros ?? [],
        idle_macros: theme.idle_macros ?? [],
        end_macros: theme.end_macros ?? [],
        variables: {
            ...variables,
            asset,
            eventUuid,
        },
    });
}

async function handleWebhook(method: string, data: any) {
    logRegular(`send webhook: ${method}`);

    const regex = new RegExp(`webhook ${method}`, "g");
    const config = getConfig(regex)[0];

    if (!config) {
        logWarn(`no webhook config found for ${method}`);
        return;
    }

    const webhookContent = JSON.parse(
        await parsePlaceholders(JSON.stringify(config.content), config.additional_data),
    );

    await fetch(config.url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookContent),
    });
}

async function handleFunction(
    method: string,
    data: any = {},
    variables: any = {}
) {
    logRegular(`trigger function: ${method}`);

    switch (method) {
        case "random": {
            const min = Number(data.min);
            const max = Number(data.max);

            if (!Number.isFinite(min) || !Number.isFinite(max)) {
                logWarn(`random requires min and max`);
                break;
            }

            if (!data.key) {
                logWarn(`random requires key`);
                break;
            }

            const value =
                Math.floor(Math.random() * (max - min + 1)) + min;

            variables[data.key] = value;

            logRegular(
                `random ${data.key}=${value} (${min}-${max})`
            );

            break;
        }

        case "toggle_auto_macro": {
            if (data.name && data.enabled !== undefined) {
                toggleAutoMacro(data.name, data.enabled);
            }
            break;
        }

        case "sleep": {
            await sleep(data.time);
            break;
        }

        case "speak": {
            await speak(data.content, data.event_uuid);
            break;
        }

        case "song_request": {
            if (!data.url) {
                logWarn(`song_request requires url`);
                break;
            }

            const added = await addSongRequest(fillTemplate(data.url, data));

            if (!added) {
                logWarn(`song_request failed`);
            }

            break;
        }

        case "song_request_toggle": {
            await toggleSongRequest();
            break;
        }


        case "send_message": {
            const primaryChannel = getPrimaryChannel();

            data.content = fillTemplate(data.content, {});

            await getTwitchClient()
                .getBot()
                .api.chat.sendChatMessage(primaryChannel, data.content);

            break;
        }

        case "send_dm": {
            if (!data.user || !data.content) {
                logWarn(`send_dm requires user and content`);
                break;
            }

            const bot = getTwitchClient().getBot();

            data.content = fillTemplate(data.content, {});

            await bot.whisper(data.user, data.content);

            break;
        }
    }
}

async function handleMusic(method: string, data: any = {}) {
    logRegular(`trigger music: ${method}`);

    switch (method) {
        case "play": {
            await musicPlay();
            break;
        }

        case "pause": {
            await musicPause();
            break;
        }

        case "toggle_pause":
        case "toggle": {
            await togglePause();
            break;
        }

        case "next": {
            await musicNext();
            break;
        }

        case "back":
        case "previous":
        case "prev": {
            await musicBack();
            break;
        }

        case "stop": {
            await stopMusicPlayback();
            break;
        }

        case "reload": {
            await reloadMusicPlayer(data.restore_state === true || data.restoreState === true);
            break;
        }

        case "volume": {
            const volume = Number(data.volume ?? data.value);

            if (!Number.isFinite(volume)) {
                logWarn(`music volume requires volume`);
                break;
            }

            await musicSetVolume(volume);
            break;
        }

        case "volume_relative":
        case "relative_volume": {
            const volume = Number(data.volume ?? data.value ?? data.delta);

            if (!Number.isFinite(volume)) {
                logWarn(`music volume_relative requires volume`);
                break;
            }

            await musicSetRelativeVolume(volume);
            break;
        }

        case "play_song":
        case "song": {
            await musicPlaySong(data);
            break;
        }

        case "shuffle": {
            if (data.enabled === undefined && data.state === undefined) {
                await toggleMusicShuffle();
            } else {
                await setMusicShuffle(data.enabled ?? data.state);
            }
            break;
        }

        case "loop":
        case "loop_playlist": {
            if (data.enabled === undefined && data.state === undefined) {
                await toggleMusicLoop();
            } else {
                await setMusicLoop(data.enabled ?? data.state);
            }
            break;
        }

        case "loop_file": {
            if (data.enabled === undefined && data.state === undefined) {
                await toggleMusicLoopFile();
            } else {
                await setMusicLoopFile(data.enabled ?? data.state);
            }
            break;
        }

        case "song_request": {
            if (!data.url) {
                logWarn(`music song_request requires url`);
                break;
            }

            const added = await addSongRequest(fillTemplate(data.url, data));

            if (!added) {
                logWarn(`music song_request failed`);
            }

            break;
        }

        case "song_request_toggle":
        case "toggle_song_request": {
            await toggleSongRequest();
            break;
        }

        default: {
            logWarn(`invalid music method: ${method}`);
            break;
        }
    }
}

async function handleObs(method: string, data: any = {}) {
    const obsClient = getOBSClient();
    const connection = data.connection ?? data.obs ?? data.target ?? 'default';

    logRegular(`trigger obs (${connection}): ${method}`);

    const obsData = {...data};
    delete obsData.connection;
    delete obsData.obs;
    delete obsData.target;

    if (method === "reload_browser_sources") {
        await obsClient.reloadAllBrowserScenes(connection);
        return;
    }

    await obsClient.send(method, obsData, connection);
}

async function handleRest(method: string, endpoint: string, data: any) {
    const config = getConfig(/^webserver/g)[0];

    logRegular(`trigger rest: ${method}`);

    const url = `http://localhost:${config.port}/api/${endpoint}`;

    await fetch(url, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            state: method,
            data,
        }),
    });
}

async function handleNeopixel(method: string, data: any) {
    if (method !== "color") {
        logWarn(`invalid neopixel method`);
        return;
    }

    if (!data.name) {
        logWarn(`neopixel name missing`);
        return;
    }

    if (!data.color) {
        logWarn(`neopixel color missing`);
        return;
    }

    await colorNeopixel(data.name, data.color, data.index);
}

async function handleChannelPoint(method: string, event: any) {
    if (!event) {
        logWarn(`channel_point requires event`);
        return;
    }

    switch (method) {
        case "cancel": {
            await event.updateStatus("CANCELED");
            break;
        }

        case "accept": {
            await event.updateStatus("FULFILLED");
            break;
        }

        default: {
            logWarn(`invalid channel_point method: ${method}`);
            break;
        }
    }
}

function evaluateCondition(check: any, variables: any) {
    if (!check || typeof check !== "string") return false;

    const expression = check.replace(/\$\{([^}]+)\}/g, (_, path) => {
        const value = getNestedValue(variables, path.trim());

        if (typeof value === "string") {
            return value.replace(/'/g, "\\'");
        }

        if (value === undefined || value === null) {
            return "";
        }

        return String(value);
    });

    try {
        return Function(`"use strict"; return (${expression});`)() === true;
    } catch (err) {
        // @ts-ignore
        logRegular(`condition error: ${check} -> ${err['message'] ?? 'NA/'}`);
        return false;
    }
}

function handleWebsocket(method: string, data: any) {
    const websocket = getWebsocketServer();

    logRegular(`trigger websocket: ${method}`);

    websocket.send(method, data);
}

function handleEffect(method: string, data: any) {
    const websocket = getWebsocketServer()

    logRegular(`trigger effect: ${method}`)

    websocket.send('notify_effect', {
        target: data.target,
        effect: method,
        content: data.content ?? '',
        options: data.options ?? {},
    })
}

function handleAnimation(method: string, data: any) {
    const websocket = getWebsocketServer()

    let startFrame = data.startFrame ?? data.start_frame ?? 0
    let stopFrame = data.stopFrame ?? data.stop_frame ?? null
    const reverse = data.reverse === true || data.reverse === "true"

    if (stopFrame === null || stopFrame === undefined) {
        stopFrame = data.totalFrames ?? data.total_frames ?? null
    }

    if (reverse && stopFrame !== null && startFrame < stopFrame) {
        const originalStartFrame = startFrame
        startFrame = stopFrame
        stopFrame = originalStartFrame
    }

    logRegular(`trigger animation: ${data.target} ${startFrame} -> ${stopFrame} speed: ${data.speed ?? 1} loop: ${data.loop ?? false} ${data.src ?? ''}`)

    websocket.send('notify_animation_update', {
        target: data.target,
        src: data.src,
        animation: method,
        startFrame,
        stopFrame,
        speed: data.speed ?? 1,
        loop: data.loop ?? false,
        totalFrames: data.totalFrames ?? data.total_frames,
        frameRate: data.frameRate ?? data.frame_rate,
        variables: data.variables ?? {},
    })
}