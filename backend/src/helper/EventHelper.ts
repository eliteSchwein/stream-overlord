import {randomUUID} from "crypto";
import {getAssetConfig, isAssetConfigPresent} from "./AssetHelper";
import {addAlert} from "./AlertHelper";
import {interpolateTemplate, isMacroPresent, triggerMacro} from "./MacroHelper";
import getWebsocketServer from "../App";

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
    simulationFields: EventSimulationField[];
};

export type EventIndex = Record<string, EventEntry[]>;

const eventEntries: EventIndex = {
    twitch: [],
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
        createEventEntry("event_giveaway_start"),
        createEventEntry("event_giveaway_end"),
    ],
    audio: [
        createEventEntry("event_audio_volume"),
        createEventEntry("event_audio_mute"),
        createEventEntry("event_audio_unmute"),
        createEventEntry("event_audio_output_volume"),
        createEventEntry("event_audio_output_link"),
        createEventEntry("event_audio_output_unlink"),
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

export function updateConfiguredEventIndex(): EventIndex {
    configuredEventIndex = {};

    for (const channel in eventEntries) {
        configuredEventIndex[channel] = eventEntries[channel].map(entry => {
            const macro = isMacroPresent(entry.configName);
            const asset = isAssetConfigPresent(entry.configName);

            return {
                ...entry,
                macro,
                asset,
                configured: macro || asset,
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
        const macro = isMacroPresent(entry.configName);
        const asset = isAssetConfigPresent(entry.configName);
        if (!macro && !asset) {
            throw new Error("event has no configured macro or asset");
        }
    }

    const event = applySimulationSchema(entry, input);
    const eventUuid = `${entry.configName}_simulation_${randomUUID()}`;

    await triggerConfiguredEvent(entry.configName, {
        event,
        eventUuid,
        simulation: true,
    });

    return {eventUuid, event};
}

export async function triggerConfiguredEvent(
    configName: string,
    variables: Record<string, any> = {},
): Promise<void> {
    const normalizedConfigName = normalizeEventConfigName(configName);

    if (!normalizedConfigName) return;

    const eventUuid = String(variables.eventUuid ?? `${normalizedConfigName}_${randomUUID()}`);
    const eventVariables = {
        ...variables,
        eventUuid,
    };

    if (isMacroPresent(normalizedConfigName)) {
        void triggerMacro(normalizedConfigName, eventVariables);
    }

    if (isAssetConfigPresent(normalizedConfigName)) {
        const asset = getAssetConfig(normalizedConfigName);
        const parsedAsset = JSON.parse(interpolateTemplate(JSON.stringify({
            sound: asset.sound,
            duration: asset.duration,
            color: asset.color,
            icon: asset.icon,
            message: asset.message,
            video: asset.video,
            lamp_color: asset.lamp_color,
            volume: asset.volume,
            image: asset.image,
            channel: asset.channel,
        }), eventVariables));

        addAlert({
            ...parsedAsset,
            "event-uuid": eventUuid,
        });
    }
}
