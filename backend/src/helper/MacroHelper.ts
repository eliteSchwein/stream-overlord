import {getAssetConfig, getConfig, getPrimaryChannel} from "./ConfigHelper";
import getWebsocketServer, {getOBSClient, getTwitchClient, getYoloboxClient} from "../App";
import {logNotice, logRegular, logWarn} from "./LogHelper";
import {sleep} from "../../../helper/GeneralHelper";
import {parsePlaceholders} from "./DataHelper";
import fillTemplate, {getTemplateVariables} from "./TemplateHelper";
import {colorNeopixel} from "./NeopixelHelper";
import {toggleAutoMacro} from "./AutoMacroHelper";
import {speak} from "./TTShelper";
import {addAlert} from "./AlertHelper";
import {v4 as uuidv4} from "uuid";

let macros: any = {};

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
        ...variables,
        ...getTemplateVariables(),
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
                    await handleFunction(task.method, task.data);
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
                    await handleAlert(task.message, task.asset, task.eventUuid);
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

    addAlert({
        dummy: true,
        duration: task.duration ?? 5,
        icon: task.icon ?? "",
        message: task.message,
        "event-uuid": variables.eventUuid ?? `macro_${uuidv4()}`,
        speak: task.speak ?? false,
    });
}

async function handleYolobox(method: string, data: any) {
    logRegular(`send yolobox command: ${method}`);

    const yoloboxData = getYoloboxClient()?.getData();

    if (!yoloboxData) {
        logWarn(`yolobox is currently not connected`);
        return;
    }

    if (method === "order_material_change") {
        for (const material of yoloboxData.MaterialList) {
            if (data.id === "all" && material.isSelected !== data.isSelected) {
                getYoloboxClient()?.sendCommand({
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

    getYoloboxClient()?.sendCommand({
        data,
        orderID: method,
    });
}

async function handleAlert(message: string, asset: string, eventUuid: string | undefined = undefined) {
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
        sound: theme.sound,
        duration: 15,
        color: theme.color,
        icon: theme.icon,
        message,
        "event-uuid": eventUuid,
        video: theme.video,
        lamp_color: theme.lamp_color,
        volume: theme.volume,
        image: theme.image,
        channel: theme.channel,
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

async function handleFunction(method: string, data: any) {
    logRegular(`trigger function: ${method}`);

    switch (method) {
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
            await speak(data.content);
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

    logRegular(`trigger animation: ${method}`)

    websocket.send('notify_animation_update', {
        target: data.target,
        src: data.src,
        animation: method,
        startFrame: data.startFrame ?? data.start_frame ?? 0,
        stopFrame: data.stopFrame ?? data.stop_frame ?? null,
        speed: data.speed ?? 1,
        loop: data.loop ?? false,
        reverse: data.reverse ?? false,
        totalFrames: data.totalFrames ?? data.total_frames,
        frameRate: data.frameRate ?? data.frame_rate,
        variables: data.variables ?? {},
    })
}