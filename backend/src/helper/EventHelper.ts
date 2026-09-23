import {randomUUID} from "crypto";
import {getAssetConfig, hasAssetConfigContent} from "./AssetHelper";
import {addAlert} from "./AlertHelper";
import {getMacroConfig, hasMacroTasks, interpolateTemplate, triggerMacro} from "./MacroHelper";
import getWebsocketServer from "../App";
import {enqueueInteraction} from "./InteractionHelper";

export type EventSimulationFieldType = "text" | "number" | "boolean" | "textarea" | "select";

export type EventSimulationField = {
    name: string;
    type: EventSimulationFieldType;
    localeKey: string;
    default?: string | number | boolean;
    required?: boolean;
    min?: number;
    max?: number;
    step?: number;
    options?: Array<{
        title: string;
        value: string | number | boolean;
    }>;
    optionsByField?: string;
    optionsByValue?: Record<string, Array<{
        title: string;
        value: string | number | boolean;
    }>>;
};

export type EventEntry = {
    name: string;
    channel: string;
    subchannel?: string;
    configName: string;
    localeKey: string;
    channelLocaleKey: string;
    macro: boolean;
    asset: boolean;
    configured: boolean;
    bypass_interaction_queue: boolean;
    simulationFields: EventSimulationField[];
};

export type EventIndex = Record<string, EventEntry[]>;

function simulationField(
    name: string,
    type: EventSimulationFieldType = "text",
    defaultValue?: string | number | boolean,
): EventSimulationField {
    return {
        name,
        type,
        localeKey: `events.simulation.${name}`,
        ...(defaultValue !== undefined ? {default: defaultValue} : {}),
    };
}

const obsConnectionFields = () => [
    simulationField("connectionName", "text", "default"),
];

const eventEntries: EventIndex = {
    system: [
        createEventEntry("event_system_poweron"),
        createEventEntry("event_system_poweroff"),
        createEventEntry("event_system_configreload"),
    ],
    music: [
        createEventEntry("event_music_start"),
        createEventEntry("event_music_end"),
        createEventEntry("event_music_next"),
        createEventEntry("event_music_prev"),
    ],
    giveaway: [
        createEventEntry("event_giveaway_start", [
            simulationField("giveawayText", "text", "Example prize"),
            simulationField("durationSeconds", "number", 600),
            simulationField("durationMinutes", "number", 10),
            simulationField("endsAt", "number", 0),
            simulationField("totalEntries", "number", 0),
            simulationField("giveawayCommand", "text", "ticket"),
        ]),
        createEventEntry("event_giveaway_register", [
            simulationField("userId", "text", "123456"),
            simulationField("userName", "text", "viewer"),
            simulationField("userDisplayName", "text", "Viewer"),
            simulationField("giveawayText", "text", "Example prize"),
            simulationField("giveawayCommand", "text", "ticket"),
            simulationField("totalEntries", "number", 1),
        ]),
        createEventEntry("event_giveaway_progress", [
            simulationField("giveawayText", "text", "Example prize"),
            simulationField("remainingSeconds", "number", 300),
            simulationField("totalSeconds", "number", 600),
            simulationField("progress", "number", 0.5),
            simulationField("totalEntries", "number", 5),
            simulationField("endsAt", "number", 0),
            simulationField("giveawayCommand", "text", "ticket"),
        ]),
        createEventEntry("event_giveaway_end", [
            simulationField("reason", "select", "finished"),
            simulationField("giveawayText", "text", "Example prize"),
            simulationField("giveawayCommand", "text", "ticket"),
            simulationField("totalEntries", "number", 5),
            simulationField("winnerId", "text", "123456"),
            simulationField("winnerName", "text", "viewer"),
            simulationField("winnerDisplayName", "text", "Viewer"),
        ]),
    ],
    audio: [
        createEventEntry("event_audio_volume"),
        createEventEntry("event_audio_mute"),
        createEventEntry("event_audio_unmute"),
        createEventEntry("event_audio_output_volume"),
        createEventEntry("event_audio_output_link"),
        createEventEntry("event_audio_output_unlink"),
    ],
    obs: [
        createEventEntry("event_obs_connected", [
            ...obsConnectionFields(),
            simulationField("connected", "boolean", true),
        ]),
        createEventEntry("event_obs_disconnected", [
            ...obsConnectionFields(),
            simulationField("connected", "boolean", false),
            simulationField("reason", "text", "connection_error"),
            simulationField("errorCode", "number", 0),
            simulationField("errorMessage", "text", "Connection closed"),
        ]),
        createEventEntry("event_obs_scene_changed", [
            ...obsConnectionFields(),
            simulationField("sceneName", "text", "Scene"),
            simulationField("sceneUuid", "text", "00000000-0000-0000-0000-000000000001"),
        ]),
        createEventEntry("event_obs_recording_started", [
            ...obsConnectionFields(),
            simulationField("outputActive", "boolean", true),
            simulationField("outputState", "text", "OBS_WEBSOCKET_OUTPUT_STARTED"),
            simulationField("outputPath", "text", "/recordings/example.mkv"),
        ]),
        createEventEntry("event_obs_recording_stopped", [
            ...obsConnectionFields(),
            simulationField("outputActive", "boolean", false),
            simulationField("outputState", "text", "OBS_WEBSOCKET_OUTPUT_STOPPED"),
            simulationField("outputPath", "text", "/recordings/example.mkv"),
        ]),
        createEventEntry("event_obs_streaming_started", [
            ...obsConnectionFields(),
            simulationField("outputActive", "boolean", true),
            simulationField("outputState", "text", "OBS_WEBSOCKET_OUTPUT_STARTED"),
        ]),
        createEventEntry("event_obs_streaming_stopped", [
            ...obsConnectionFields(),
            simulationField("outputActive", "boolean", false),
            simulationField("outputState", "text", "OBS_WEBSOCKET_OUTPUT_STOPPED"),
        ]),
        createEventEntry("event_obs_replay_buffer_started", [
            ...obsConnectionFields(),
            simulationField("outputActive", "boolean", true),
            simulationField("outputState", "text", "OBS_WEBSOCKET_OUTPUT_STARTED"),
        ]),
        createEventEntry("event_obs_replay_buffer_stopped", [
            ...obsConnectionFields(),
            simulationField("outputActive", "boolean", false),
            simulationField("outputState", "text", "OBS_WEBSOCKET_OUTPUT_STOPPED"),
        ]),
        createEventEntry("event_obs_virtual_camera_started", [
            ...obsConnectionFields(),
            simulationField("outputActive", "boolean", true),
            simulationField("outputState", "text", "OBS_WEBSOCKET_OUTPUT_STARTED"),
        ]),
        createEventEntry("event_obs_virtual_camera_stopped", [
            ...obsConnectionFields(),
            simulationField("outputActive", "boolean", false),
            simulationField("outputState", "text", "OBS_WEBSOCKET_OUTPUT_STOPPED"),
        ]),
        createEventEntry("event_obs_studio_mode_enabled", [
            ...obsConnectionFields(),
            simulationField("studioModeEnabled", "boolean", true),
        ]),
        createEventEntry("event_obs_studio_mode_disabled", [
            ...obsConnectionFields(),
            simulationField("studioModeEnabled", "boolean", false),
        ]),
        createEventEntry("event_obs_scene_item_enabled", [
            ...obsConnectionFields(),
            simulationField("sceneName", "text", "Scene"),
            simulationField("sceneUuid", "text", "00000000-0000-0000-0000-000000000001"),
            simulationField("sceneItemId", "number", 1),
            simulationField("sceneItemEnabled", "boolean", true),
            simulationField("sourceName", "text", "Camera"),
            simulationField("sourceUuid", "text", "00000000-0000-0000-0000-000000000003"),
        ]),
        createEventEntry("event_obs_scene_item_disabled", [
            ...obsConnectionFields(),
            simulationField("sceneName", "text", "Scene"),
            simulationField("sceneUuid", "text", "00000000-0000-0000-0000-000000000001"),
            simulationField("sceneItemId", "number", 1),
            simulationField("sceneItemEnabled", "boolean", false),
            simulationField("sourceName", "text", "Camera"),
            simulationField("sourceUuid", "text", "00000000-0000-0000-0000-000000000003"),
        ]),
        createEventEntry("event_obs_input_muted", [
            ...obsConnectionFields(),
            simulationField("inputName", "text", "Mic/Aux"),
            simulationField("inputUuid", "text", "00000000-0000-0000-0000-000000000002"),
            simulationField("inputMuted", "boolean", true),
        ]),
        createEventEntry("event_obs_input_unmuted", [
            ...obsConnectionFields(),
            simulationField("inputName", "text", "Mic/Aux"),
            simulationField("inputUuid", "text", "00000000-0000-0000-0000-000000000002"),
            simulationField("inputMuted", "boolean", false),
        ]),
        createEventEntry("event_obs_profile_changed", [
            ...obsConnectionFields(),
            simulationField("profileName", "text", "Untitled"),
        ]),
        createEventEntry("event_obs_scene_collection_changed", [
            ...obsConnectionFields(),
            simulationField("sceneCollectionName", "text", "Untitled"),
        ]),
    ],
    yolobox: [
        createEventEntry("event_yolobox_connected", [
            simulationField("connected", "boolean", true),
            simulationField("device", "text", "192.168.1.100"),
        ]),
        createEventEntry("event_yolobox_disconnected", [
            simulationField("connected", "boolean", false),
            simulationField("device", "text", "192.168.1.100"),
        ]),
    ],
};

let configuredEventIndex: EventIndex = {};

export function normalizeEventConfigName(configName: string) {
    return String(configName ?? "")
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_.-]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function createEventEntry(
    configName: string,
    simulationFields: EventSimulationField[] = [],
): EventEntry {
    const normalizedConfigName = normalizeEventConfigName(configName);
    const parts = normalizedConfigName.split("_").filter(Boolean);

    if (parts[0] === "event") {
        parts.shift();
    }

    const channel = parts.shift() ?? "system";
    const nameParts = parts;
    const name = nameParts.join("_") || channel;

    return {
        name,
        channel,
        configName: normalizedConfigName,
        localeKey: `events.items.${normalizedConfigName}`,
        channelLocaleKey: `events.channels.${channel}`,
        macro: false,
        asset: false,
        configured: false,
        bypass_interaction_queue: false,
        simulationFields,
    };
}

function upsertEventEntry(entry: EventEntry) {
    if (!eventEntries[entry.channel]) {
        eventEntries[entry.channel] = [];
    }

    const index = eventEntries[entry.channel].findIndex(item => item.configName === entry.configName);

    if (index >= 0) {
        eventEntries[entry.channel][index] = {
            ...eventEntries[entry.channel][index],
            ...entry,
        };
        return;
    }

    eventEntries[entry.channel].push(entry);
}

export function registerEventEntry(
    configName: string,
    simulationFields: EventSimulationField[] = [],
): EventEntry {
    const entry = createEventEntry(configName, simulationFields);
    upsertEventEntry(entry);
    updateConfiguredEventIndex();
    return entry;
}

export function registerEventEntries(configNames: string[] = []) {
    return configNames.map(configName => registerEventEntry(configName));
}

export function getEventEntries(): EventIndex {
    return eventEntries;
}

export function getEventEntry(configName: string): EventEntry | undefined {
    const normalizedConfigName = normalizeEventConfigName(configName);

    for (const channel of Object.values(eventEntries)) {
        const entry = channel.find(item => item.configName === normalizedConfigName);
        if (entry) return entry;
    }

    return undefined;
}

export function updateSimulationSelectOptions(
    fieldName: string,
    options: EventSimulationField["options"],
    optionsByValue?: EventSimulationField["optionsByValue"],
) {
    for (const entries of Object.values(eventEntries)) {
        for (const entry of entries) {
            for (const field of entry.simulationFields) {
                if (field.name !== fieldName || field.type !== "select") continue;

                if (options) field.options = options;
                if (optionsByValue) field.optionsByValue = optionsByValue;
            }
        }
    }

    updateConfiguredEventIndex();
}

export function notifyEventsUpdate() {
    try {
        getWebsocketServer()?.send("notify_events_update", {
            events: configuredEventIndex,
        });
    } catch (_) {
        // Websocket server may not be initialized yet during early startup.
    }
}

function coerceEventBoolean(value: unknown): boolean {
    if (value === true || value === 1) return true;
    if (typeof value === "string") {
        return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
    }
    return false;
}

export function getEventBypassInteractionQueue(configName: string): boolean {
    const normalizedConfigName = normalizeEventConfigName(configName);
    const macroConfig = getMacroConfig(normalizedConfigName);

    if (macroConfig && Object.prototype.hasOwnProperty.call(macroConfig, "bypass_interaction_queue")) {
        return coerceEventBoolean(macroConfig.bypass_interaction_queue);
    }

    const assetConfig = getAssetConfig(normalizedConfigName);
    if (assetConfig && Object.prototype.hasOwnProperty.call(assetConfig, "bypass_interaction_queue")) {
        return coerceEventBoolean(assetConfig.bypass_interaction_queue);
    }

    return false;
}

export function updateConfiguredEventIndex(): EventIndex {
    configuredEventIndex = {};

    for (const channel in eventEntries) {
        configuredEventIndex[channel] = eventEntries[channel].map(entry => {
            const macro = hasMacroTasks(entry.configName);
            const asset = hasAssetConfigContent(entry.configName);

            return {
                ...entry,
                macro,
                asset,
                configured: macro || asset,
                bypass_interaction_queue: getEventBypassInteractionQueue(entry.configName),
            };
        });
    }

    notifyEventsUpdate();

    return configuredEventIndex;
}

export function getConfiguredEventIndex(): EventIndex {
    if (!Object.keys(configuredEventIndex).length) {
        return updateConfiguredEventIndex();
    }

    return configuredEventIndex;
}

function applySimulationSchema(entry: EventEntry, input: Record<string, any>): Record<string, any> {
    const output: Record<string, any> = {};

    for (const field of entry.simulationFields) {
        let value = input?.[field.name];

        if (value === undefined || value === null || value === "") {
            value = field.default;
        }

        if (field.required && (value === undefined || value === null || value === "")) {
            throw new Error(`simulation field '${field.name}' is required`);
        }

        if (value === undefined) continue;

        if (field.type === "number") {
            value = Number(value);
            if (!Number.isFinite(value)) {
                throw new Error(`simulation field '${field.name}' must be a number`);
            }
            if (field.min !== undefined && value < field.min) value = field.min;
            if (field.max !== undefined && value > field.max) value = field.max;
        } else if (field.type === "boolean") {
            value = value === true || value === "true" || value === 1 || value === "1";
        } else {
            value = String(value);
        }

        output[field.name] = value;
    }

    return output;
}

export async function simulateConfiguredEvent(
    configName: string,
    input: Record<string, any> = {},
): Promise<{eventUuid: string; event: Record<string, any>}> {
    const entry = getEventEntry(configName);

    if (!entry) {
        throw new Error("event not found");
    }

    if (!entry.configured) {
        const macro = hasMacroTasks(entry.configName);
        const asset = hasAssetConfigContent(entry.configName);
        if (!macro && !asset) {
            throw new Error("event has no configured macro or asset");
        }
    }

    const event = applySimulationSchema(entry, input);
    const eventUuid = `${entry.configName}_simulation_${randomUUID()}`;

    await triggerConfiguredEvent(entry.configName, {
        // Keep simulated events aligned with live Twitch events: fields are
        // available directly and through the structured event object.
        ...event,
        event,
        eventUuid,
        simulation: true,
    });

    return {eventUuid, event};
}

export async function triggerConfiguredEvent(
    configName: string,
    variables: Record<string, any> = {},
    interactionName?: string,
): Promise<void> {
    const normalizedConfigName = normalizeEventConfigName(configName);

    if (!normalizedConfigName) return;

    const eventUuid = String(variables.eventUuid ?? `${normalizedConfigName}_${randomUUID()}`);
    const hasMacro = hasMacroTasks(normalizedConfigName);
    const hasAsset = hasAssetConfigContent(normalizedConfigName);
    if (!hasMacro && !hasAsset) return;

    const configuredAsset = hasAsset ? getAssetConfig(normalizedConfigName) : undefined;
    const estimatedDuration = configuredAsset ? Number(configuredAsset.duration ?? 0) || 0 : 0;
    const bypassInteractionQueue = getEventBypassInteractionQueue(normalizedConfigName);

    const execute = async (interactionUuid?: string) => {
        const eventVariables = {
            ...variables,
            eventUuid,
            ...(interactionUuid ? {interactionUuid} : {}),
        };

        if (hasMacro) {
            await triggerMacro(normalizedConfigName, eventVariables);
        }

        if (hasAsset && configuredAsset) {
            const parsedAsset = JSON.parse(interpolateTemplate(JSON.stringify({
                sound: configuredAsset.sound,
                duration: configuredAsset.duration,
                color: configuredAsset.color,
                icon: configuredAsset.icon,
                message: configuredAsset.message,
                video: configuredAsset.video,
                lamp_color: configuredAsset.lamp_color,
                volume: configuredAsset.volume,
                image: configuredAsset.image,
                channel: configuredAsset.channel,
                wled: configuredAsset.wled,
                start_macros: configuredAsset.start_macros ?? [],
                idle_macros: configuredAsset.idle_macros ?? [],
                end_macros: configuredAsset.end_macros ?? [],
            }), eventVariables));

            addAlert({
                ...parsedAsset,
                asset: normalizedConfigName,
                variables: eventVariables,
                ...(interactionUuid ? {interaction_uuid: interactionUuid} : {}),
                "event-uuid": eventUuid,
            });
        }
    };

    if (bypassInteractionQueue) {
        await execute();
        return;
    }

    enqueueInteraction({
        uuid: eventUuid,
        name: interactionName ?? `Event: ${normalizedConfigName.replace(/^event_/, "").replace(/_/g, " ")}`,
        source: "event",
        estimatedDuration: hasAsset && !hasMacro ? estimatedDuration : 0,
        execute: async () => execute(eventUuid),
    });
}
