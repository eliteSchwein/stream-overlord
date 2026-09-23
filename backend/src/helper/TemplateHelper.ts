import {getRawGameInfo} from "./GameHelper";
import getWebsocketServer, {getOBSClient, getYoloboxClient} from "../App";
import {getSystemComponents} from "./SystemInfoHelper";
import {getGiveaway} from "./GiveawayHelper";
import {
    getActiveMusicPath,
    getRegularMusicFiles,
    getSongCmd,
    getSongRequestState,
    getStatus,
    isSongRequestEnabled,
    isSongRequestQueryAlreadyPresent,
    isSongRequestQueryBlocked,
} from "./MusicHelper";
import {getCachedVariables} from "./VariableHelper";
import {getCachedTwitchData} from "./TwitchDataHelper";
import {getIntegrationsSafe} from "./IntegrationsHelper";
import {getCategoryLibrary, getActiveCategoryEntry} from "./CategoryLibraryHelper";

export default function fillTemplate(tpl: string, data: any) {
    const ctx = getTemplateVariables(data);

    const SAFE = new Set(["__proto__", "prototype", "constructor"]);
    const getByPath = (o: any, p: string) => p.split(".").every(k => !SAFE.has(k))
        ? p.split(".").reduce((a, k) => (a != null ? a[k] : undefined), o)
        : undefined;

    return tpl.replace(/\$\{([^}]+)\}/g, (m, raw) => {
        const expr = String(raw).trim();
        const [root, ...rest] = expr.split(".");
        const key = root.toLowerCase();

        if (!(key in ctx)) return m;

        const val = getByPath(ctx[key], rest.join("."));

        return val == null ? m : String(val);
    });
}


function stripObsCollectionAliases(value: any) {
    if (!value || typeof value !== "object") return {};

    const {
        scenes: _scenes,
        scenes_list: _scenesList,
        scenes_array: _scenesArray,
        items: _items,
        items_list: _itemsList,
        items_array: _itemsArray,
        children: _children,
        children_list: _childrenList,
        children_array: _childrenArray,
        ...rest
    } = value;

    return rest;
}

function mapObsItemsByUuid(items: any[] = []): Record<string, any> {
    const result: Record<string, any> = {};

    for (const item of items ?? []) {
        const sourceUuid = String(item?.uuid ?? item?.sourceUuid ?? "").trim();
        if (!sourceUuid) continue;

        result[sourceUuid] = {
            ...stripObsCollectionAliases(item),
            children: mapObsItemsByUuid(Array.isArray(item?.children) ? item.children : []),
        };
    }

    return result;
}

function mapObsCanvasesByUuid(canvasList: any[] = []): Record<string, any> {
    const canvases: Record<string, any> = {};

    for (const canvas of canvasList ?? []) {
        const canvasUuid = String(canvas?.uuid ?? canvas?.canvasUuid ?? "").trim();
        const canvasKey = canvasUuid || "default";
        const scenes: Record<string, any> = {};

        for (const scene of Array.isArray(canvas?.scenes) ? canvas.scenes : []) {
            const sceneUuid = String(scene?.uuid ?? scene?.sceneUuid ?? "").trim();
            if (!sceneUuid) continue;

            scenes[sceneUuid] = {
                ...stripObsCollectionAliases(scene),
                items: mapObsItemsByUuid(Array.isArray(scene?.items) ? scene.items : []),
            };
        }

        canvases[canvasKey] = {
            ...stripObsCollectionAliases(canvas),
            scenes,
        };
    }

    return canvases;
}

export function getTemplateVariables(data: any = {}) {
    const musicStatus = getStatus();
    const musicText = getSongCmd();
    const songRequest = getSongRequestState();
    const songRequestUrl = data?.url ?? data?.input ?? "";

    const songRequestTemplateState = {
        ...songRequest,
        query: songRequestUrl,
        query_blocked: isSongRequestQueryBlocked(songRequestUrl),
        query_already_present: isSongRequestQueryAlreadyPresent(songRequestUrl),
    };

    const passedData = data && typeof data === "object" && !Array.isArray(data)
        ? data
        : {};
    const {variables: passedVariables, data: nestedData, ...directPassedData} = passedData;
    const templateRootKeys = new Set([
        "twitch",
        "gameinfo",
        "musicinfo",
        "musictext",
        "music",
        "songrequest",
        "systeminfo",
        "giveaway",
        "obs",
        "yolobox",
        "integrations",
        "connections",
        "timers",
        "interactions",
        "rotating_scenes",
        "time",
        "auto_macros",
        "commands",
        "channel_points",
        "category_library",
    ]);
    const runtimeVariables = Object.fromEntries(
        Object.entries(directPassedData).filter(([key]) => !templateRootKeys.has(key)),
    );
    const variables = {
        ...getCachedVariables(),
        ...(nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)
            ? nestedData
            : {}),
        ...runtimeVariables,
        ...(passedVariables && typeof passedVariables === "object" && !Array.isArray(passedVariables)
            ? passedVariables
            : {}),
    };

    // Load helpers lazily here. AutoMacroHelper and TwitchCommands both reach
    // MacroHelper, which itself imports TemplateHelper. Requiring them only
    // when a template context is requested avoids making that module cycle an
    // initialization-time dependency.
    const {getAutoMacros} = require("./AutoMacroHelper") as typeof import("./AutoMacroHelper");
    const {getConfiguredCommands} = require("../clients/twitch/TwitchCommands") as typeof import("../clients/twitch/TwitchCommands");
    const {getChannelPointUpdatePayload} = require("./ChannelPointHelper") as typeof import("./ChannelPointHelper");

    const integrations = getIntegrationsSafe();

    const obsClient = getOBSClient?.();
    const obsConnectionNames = Array.from(new Set([
        ...Object.keys(integrations.obs ?? {}),
        ...(obsClient?.getConnectionNames?.() ?? []),
    ]));
    const obsConnections = Object.fromEntries(obsConnectionNames.map(name => {
        const canvasList = obsClient?.getSceneData?.(name) ?? [];

        return [
            name,
            {
                connected: integrations.obs?.[name]?.connected === true,
                canvases: mapObsCanvasesByUuid(canvasList),
                audio: obsClient?.getAudioData?.(name) ?? {},
            },
        ];
    }));
    const defaultObsName = obsConnections.default
        ? "default"
        : obsConnectionNames[0];
    const obs = {
        connected: Object.values(obsConnections).some((connection: any) => connection?.connected === true),
        connections: obsConnections,
        default: defaultObsName ? obsConnections[defaultObsName] : undefined,
    };

    const yoloboxClient = getYoloboxClient?.();
    const yoloboxData = yoloboxClient?.getData?.() ?? {};
    const yolobox = {
        ...yoloboxData,
        enabled: integrations.yolobox?.enabled === true,
        connected: integrations.yolobox?.connected === true,
        device: yoloboxClient?.getIp?.() ?? "",
        data: yoloboxData,
    };

    const autoMacroList = getAutoMacros?.() ?? [];
    const autoMacros = Object.fromEntries(autoMacroList
        .filter((autoMacro: any) => autoMacro?.name)
        .map((autoMacro: any) => {
            const intervalSeconds = Math.max(0, Number(autoMacro?.interval ?? 0) || 0);
            const remainingSeconds = Math.max(0, Number(autoMacro?.current_interval ?? intervalSeconds) || 0);
            const elapsedSeconds = Math.max(0, intervalSeconds - remainingSeconds);

            return [String(autoMacro.name), {
                ...autoMacro,
                enabled: autoMacro?.enabled === true,
                interval_seconds: intervalSeconds,
                remaining_seconds: remainingSeconds,
                next_run_seconds: remainingSeconds,
                elapsed_seconds: elapsedSeconds,
                progress: intervalSeconds > 0
                    ? Math.min(100, Math.max(0, Math.round((elapsedSeconds / intervalSeconds) * 100)))
                    : 0,
            }];
        }));

    const configuredCommands = getConfiguredCommands?.() ?? {};
    const commands = Object.fromEntries(Object.entries(configuredCommands).map(([name, command]: [string, any]) => {
        const configuredEnabled = command?.enabled !== false;
        const runtimeEnabled = command?.runtime_enabled === true;

        return [name, {
            ...command,
            configured_enabled: configuredEnabled,
            enabled: runtimeEnabled,
            runtime_enabled: runtimeEnabled,
        }];
    }));

    const channelPointPayload = getChannelPointUpdatePayload?.() ?? {active: [], all: []};
    const channelPoints = Object.fromEntries((channelPointPayload.all ?? [])
        .map((channelPoint: any) => {
            const key = String(
                channelPoint?.name
                ?? channelPoint?.label
                ?? channelPoint?.twitch_name
                ?? channelPoint?.twitch_label
                ?? "",
            ).trim();

            if (!key) return undefined;

            return [key, {
                ...channelPoint,
                enabled: channelPoint?.active === true,
                active: channelPoint?.active === true,
            }];
        })
        .filter(Boolean) as [string, any][]);

    const {getTimers} = require("./TimerHelper") as typeof import("./TimerHelper");
    const {getInteractionQueue} = require("./InteractionHelper") as typeof import("./InteractionHelper");
    const {getRotateScenes, getRotateSceneRuntimeState} = require("./RotateSceneHelper") as typeof import("./RotateSceneHelper");
    const {getManagedConnections} = require("./ConnectionHelper") as typeof import("./ConnectionHelper");

    const timerList = getTimers?.() ?? [];
    const timers = Object.fromEntries(timerList
        .filter((timer: any) => timer?.name)
        .map((timer: any) => [String(timer.name), timer]));

    const interactionQueue = getInteractionQueue?.() ?? [];
    const currentInteraction = interactionQueue.find((interaction: any) => interaction?.state === "active") ?? null;
    const interactions = {
        current: currentInteraction,
        active: currentInteraction !== null,
        total: interactionQueue.length,
        queued: interactionQueue.filter((interaction: any) => interaction?.state === "queued").length,
        queue: interactionQueue,
    };

    const rotateSceneRuntime = getRotateSceneRuntimeState?.() ?? {};
    const rotateScenes = getRotateScenes?.() ?? {};
    const rotatingScenes = Object.fromEntries(Object.entries(rotateScenes).map(([name, rotateScene]: [string, any]) => [
        name,
        {
            ...rotateScene,
            active: rotateSceneRuntime?.name === name && rotateSceneRuntime?.active === true,
            current_scene_uuid: rotateSceneRuntime?.name === name ? rotateSceneRuntime?.sceneUuid : undefined,
            current_index: rotateSceneRuntime?.name === name ? rotateSceneRuntime?.index : undefined,
        },
    ]));

    const now = new Date();
    const time = {
        iso: now.toISOString(),
        unix: Math.floor(now.getTime() / 1000),
        unix_ms: now.getTime(),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        weekday: now.getDay(),
    };

    const ctx: Record<string, any> = {
        variables,
        twitch: getCachedTwitchData(),
        gameinfo: getRawGameInfo()?.data,

        musicinfo: musicStatus,
        musictext: musicText,

        music: {
            status: musicStatus,
            text: musicText,
            active_path: getActiveMusicPath(),
            regular_files: getRegularMusicFiles(),
            songrequest: songRequestTemplateState,
            songrequest_enabled: isSongRequestEnabled(),
        },

        songrequest: songRequestTemplateState,

        systeminfo: getSystemComponents(),
        giveaway: getGiveaway(),
        category_library: {
            ...getCategoryLibrary(),
            active: getActiveCategoryEntry(),
        },

        obs,
        yolobox,
        integrations,
        connections: getManagedConnections?.() ?? {},
        timers,
        interactions,
        rotating_scenes: rotatingScenes,
        time,
        auto_macros: autoMacros,
        commands,
        channel_points: channelPoints,
    };

    return ctx;
}

export function updateTemplateVariables() {
    getWebsocketServer().send("notify_variables_update", getTemplateVariables());
}