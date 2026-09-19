import {randomUUID} from "crypto";
import {getTemplateVariables} from "./TemplateHelper";

type TemplateEditorContext = "auto" | "macro" | "event" | "command" | "channel_point" | "timer" | "auto_macro";

type TemplateVariableEntry = {
    path: string;
    expression: string;
    type: string;
    example: any;
};

type ContextPayload = {
    context: Exclude<TemplateEditorContext, "auto">;
    name?: string;
    payload: Record<string, any>;
};

function normalizeContext(value: unknown): TemplateEditorContext {
    const normalized = String(value ?? "auto").trim().toLowerCase().replace(/[\s-]+/g, "_");

    switch (normalized) {
        case "event":
        case "events":
            return "event";
        case "command":
        case "commands":
            return "command";
        case "channel_point":
        case "channel_points":
        case "channelpoint":
        case "reward":
            return "channel_point";
        case "timer":
        case "timers":
            return "timer";
        case "auto_macro":
        case "auto_macros":
        case "automacro":
            return "auto_macro";
        case "macro":
        case "generic":
            return "macro";
        default:
            return "auto";
    }
}

function safeJsonValue(value: any) {
    if (typeof value !== "string") return value;

    const trimmed = value.trim();
    if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
        return value;
    }

    try {
        return JSON.parse(trimmed);
    } catch (_) {
        return value;
    }
}

function getSimulationDummyValue(field: any) {
    if (field?.default !== undefined) {
        return field?.json === true ? safeJsonValue(field.default) : field.default;
    }

    if (field?.type === "number") return 1;
    if (field?.type === "boolean") return false;
    if (field?.type === "select") return field?.options?.[0]?.value ?? "example";
    return "example";
}

function buildEventPayload(configName: string): ContextPayload | undefined {
    const {getEventEntry} = require("./EventHelper") as typeof import("./EventHelper");
    const entry = getEventEntry?.(configName);
    if (!entry) return undefined;

    const payload: Record<string, any> = {
        eventUuid: `${entry.configName}_editor_${randomUUID()}`,
    };

    const event: Record<string, any> = entry.channel === "twitch"
        ? {
            broadcasterId: "123456789",
            broadcasterName: "testchannel",
            broadcasterDisplayName: "TestChannel",
        }
        : {};

    for (const field of entry.simulationFields ?? []) {
        event[field.name] = getSimulationDummyValue(field);
    }

    // Match runtime event payloads: event properties are available both
    // directly and through the structured event object.
    Object.assign(payload, event);
    payload.event = event;

    return {
        context: "event",
        name: entry.configName,
        payload,
    };
}

function getCommandParamExample(param: any) {
    switch (String(param?.type ?? "string")) {
        case "number":
            return 1;
        case "user":
            return "TestUser";
        case "subcommand":
            return param?.subcommands?.[0]?.name ?? "example";
        case "all":
            return "example text";
        default:
            return "example";
    }
}

function findCommand(name: string, macroName?: string) {
    const {getConfiguredCommands, resolveCommandName} = require("../clients/twitch/TwitchCommands") as typeof import("../clients/twitch/TwitchCommands");
    const commands = getConfiguredCommands?.() ?? {};
    const resolvedName = resolveCommandName?.(name);

    if (resolvedName && commands[resolvedName]) {
        return {name: resolvedName, config: commands[resolvedName]};
    }

    if (macroName) {
        const match = Object.entries(commands).find(([, config]: [string, any]) => String(config?.macro ?? "").trim() === macroName);
        if (match) return {name: match[0], config: match[1] as any};
    }

    return undefined;
}

function buildCommandPayload(name: string, macroName?: string): ContextPayload | undefined {
    const command = findCommand(name, macroName);
    if (!command) return undefined;

    const params = Object.fromEntries((Array.isArray(command.config?.params) ? command.config.params : [])
        .filter((param: any) => String(param?.name ?? "").trim())
        .map((param: any) => [String(param.name), getCommandParamExample(param)]));

    const context = {
        messageId: "editor-message-id",
        userId: "987654321",
        userName: "testuser",
        userDisplayName: "TestUser",
        broadcasterId: "123456789",
        broadcasterName: "testchannel",
    };

    return {
        context: "command",
        name: command.name,
        payload: {
            eventUuid: `command_editor_${randomUUID()}`,
            command: command.name,
            params,
            ...context,
            context,
            ...params,
        },
    };
}

function findChannelPoint(name: string, macroName?: string) {
    const {getChannelPointUpdatePayload} = require("./ChannelPointHelper") as typeof import("./ChannelPointHelper");
    const points = getChannelPointUpdatePayload?.()?.all ?? [];
    const normalized = String(name ?? "").trim().toLowerCase();

    const byName = points.find((point: any) => [
        point?.name,
        point?.label,
        point?.twitch_name,
        point?.twitch_label,
        point?.title,
    ].some(value => String(value ?? "").trim().toLowerCase() === normalized));

    if (byName) return byName;

    if (macroName) {
        return points.find((point: any) => String(point?.macro ?? "").trim() === macroName);
    }

    return undefined;
}

function buildChannelPointPayload(name: string, macroName?: string): ContextPayload | undefined {
    const point = findChannelPoint(name, macroName);
    if (!point) return undefined;

    const title = String(point?.twitch_label ?? point?.label ?? point?.name ?? "Test Reward");
    const input = point?.input_required === true ? "Example viewer input" : "";
    const userId = "987654321";
    const userName = "testuser";
    const userDisplayName = "TestUser";
    const broadcasterName = "testchannel";

    return {
        context: "channel_point",
        name: String(point?.name ?? point?.label ?? title),
        payload: (() => {
            const event = {
                id: "editor-redemption-id",
                redemptionId: "editor-redemption-id",
                broadcasterId: "123456789",
                broadcasterName,
                broadcasterDisplayName: "TestChannel",
                userId,
                userName,
                userDisplayName,
                rewardId: String(point?.id ?? "editor-reward-id"),
                rewardTitle: title,
                rewardName: title,
                rewardCost: Number(point?.cost ?? 100) || 100,
                rewardPrompt: String(point?.prompt ?? ""),
                input,
                userInput: input,
                status: "unfulfilled",
            };

            return {
                eventUuid: `channel_point_editor_${randomUUID()}`,
                ...event,
                event,
                channelPoint: {
                title,
                userId,
                userName,
                userDisplayName,
                broadcasterName,
                    input,
                },
            };
        })(),
    };
}

function buildTimerPayload(name: string, macroName?: string): ContextPayload | undefined {
    const {getTimers} = require("./TimerHelper") as typeof import("./TimerHelper");
    const timers = getTimers?.() ?? [];
    const timer = timers.find((item: any) => String(item?.name ?? "") === name)
        ?? (macroName ? timers.find((item: any) => String(item?.finished_macro ?? "") === macroName) : undefined);

    if (!timer && !name) return undefined;

    const timerName = String(timer?.name ?? name ?? "timer");
    const total = Number(timer?.defaultTime ?? timer?.time ?? 60) || 60;
    const remaining = Number(timer?.time ?? total) || total;

    return {
        context: "timer",
        name: timerName,
        payload: {
            timer: {
                name: timerName,
                time: remaining,
                defaultTime: total,
                progress: Number(timer?.progress ?? 0) || 0,
                end: timer?.end ?? "blink",
                finished_macro: String(timer?.finished_macro ?? macroName ?? ""),
            },
        },
    };
}

function buildAutoMacroPayload(name: string): ContextPayload {
    return {
        context: "auto_macro",
        name,
        payload: {},
    };
}

function buildGenericPayload(name?: string): ContextPayload {
    return {
        context: "macro",
        name,
        payload: {},
    };
}

function detectContext(name: string, macroName: string): ContextPayload {
    const event = buildEventPayload(name || macroName);
    if (event) return event;

    const channelPoint = buildChannelPointPayload(name, macroName);
    if (channelPoint) return channelPoint;

    const command = buildCommandPayload(name, macroName);
    if (command) return command;

    const timer = buildTimerPayload(name, macroName);
    if (timer) return timer;

    return buildGenericPayload(macroName || name);
}

function flattenTemplateVariables(value: any, prefix = "", output: TemplateVariableEntry[] = [], seen = new WeakSet<object>()) {
    if (value === null || value === undefined || typeof value !== "object") {
        if (!prefix) return output;

        output.push({
            path: prefix,
            expression: `\${${prefix}}`,
            type: value === null ? "null" : Array.isArray(value) ? "array" : typeof value,
            example: value,
        });
        return output;
    }

    if (seen.has(value)) return output;
    seen.add(value);

    if (Array.isArray(value)) {
        if (value.length === 0 && prefix) {
            output.push({path: prefix, expression: `\${${prefix}}`, type: "array", example: []});
            return output;
        }

        value.forEach((entry, index) => flattenTemplateVariables(entry, prefix ? `${prefix}.${index}` : String(index), output, seen));
        return output;
    }

    const entries = Object.entries(value);
    if (!entries.length && prefix) {
        output.push({path: prefix, expression: `\${${prefix}}`, type: "object", example: {}});
        return output;
    }

    for (const [key, entry] of entries) {
        flattenTemplateVariables(entry, prefix ? `${prefix}.${key}` : key, output, seen);
    }

    return output;
}

export function getEditorTemplateVariables(input: any = {}) {
    const requestedContext = normalizeContext(input?.context ?? input?.type ?? input?.source);
    const name = String(input?.name ?? input?.configName ?? input?.source_name ?? "").trim();
    const macroName = String(input?.macro ?? input?.macroName ?? (requestedContext === "macro" || requestedContext === "auto" ? name : "")).trim();

    let contextPayload: ContextPayload | undefined;

    switch (requestedContext) {
        case "event":
            contextPayload = buildEventPayload(name || macroName);
            break;
        case "command":
            contextPayload = buildCommandPayload(name, macroName);
            break;
        case "channel_point":
            contextPayload = buildChannelPointPayload(name, macroName);
            break;
        case "timer":
            contextPayload = buildTimerPayload(name, macroName);
            break;
        case "auto_macro":
            contextPayload = buildAutoMacroPayload(name || macroName);
            break;
        case "macro":
            contextPayload = buildGenericPayload(macroName || name);
            break;
        default:
            contextPayload = detectContext(name, macroName);
            break;
    }

    if (!contextPayload) {
        throw new Error(`${requestedContext} context not found${name ? `: ${name}` : ""}`);
    }

    const customVariables = input?.variables && typeof input.variables === "object" && !Array.isArray(input.variables)
        ? input.variables
        : {};
    const payload = {
        ...contextPayload.payload,
        ...customVariables,
    };
    // Mirror triggerMacro() exactly: global template roots are created first,
    // then the raw runtime payload is spread on top. This keeps editor
    // autocomplete paths identical to what the macro interpolator can resolve.
    const tree = {
        ...getTemplateVariables(),
        ...payload,
    };
    const payloadPaths = new Set(flattenTemplateVariables(payload).map(entry => entry.path));
    const directPayloadRoots = new Set(
        Object.entries(payload)
            .filter(([, value]) => value === null || value === undefined || typeof value !== "object")
            .map(([key]) => key),
    );

    const getPathPriority = (path: string) => {
        const root = path.split(".", 1)[0];

        // Context-specific direct values should be the first autocomplete
        // suggestions: ${userDisplayName}, ${rewardTitle}, ${command}, etc.
        if (payloadPaths.has(path) && directPayloadRoots.has(root)) return 0;

        // Then expose the structured version of the same runtime payload,
        // e.g. ${event.userDisplayName}, ${context.userDisplayName},
        // ${channelPoint.title}, ${params.foo}.
        if (payloadPaths.has(path)) return 1;

        // Global/runtime template roots come afterwards.
        return 2;
    };

    const paths = flattenTemplateVariables(tree)
        .sort((a, b) => {
            const priorityDiff = getPathPriority(a.path) - getPathPriority(b.path);
            return priorityDiff || a.path.localeCompare(b.path);
        });

    return {
        context: contextPayload.context,
        requested_context: requestedContext,
        name: (contextPayload.name ?? name) || undefined,
        macro: macroName || undefined,
        payload,
        template_variables: tree,
        paths,
    };
}
