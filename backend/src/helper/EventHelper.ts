import {isAssetConfigPresent} from "./AssetHelper";
import {isMacroPresent} from "./MacroHelper";

export type EventEntry = {
    name: string;
    channel: string;
    subchannel?: string;
    configName: string;
    macro: boolean;
    asset: boolean;
    configured: boolean;
};

export type EventIndex = Record<string, EventEntry[]>;

const eventEntries: EventIndex = {
    twitch: [],
    system: [
        createEventEntry("event_system_poweron"),
        createEventEntry("event_system_poweroff"),
        createEventEntry("event_system_configreload"),
    ],
};

let configuredEventIndex: EventIndex = {};

function normalizeEventConfigName(configName: string) {
    return String(configName ?? "")
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_.-]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function createEventEntry(configName: string): EventEntry {
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
        // Do not set subchannel to the same value as channel.
        // This prevents UI output like System -> System or Twitch -> Twitch.
        configName: normalizedConfigName,
        macro: false,
        asset: false,
        configured: false,
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

export function registerEventEntry(configName: string): EventEntry {
    const entry = createEventEntry(configName);
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

    return configuredEventIndex;
}

export function getConfiguredEventIndex(): EventIndex {
    if (!Object.keys(configuredEventIndex).length) {
        return updateConfiguredEventIndex();
    }

    return configuredEventIndex;
}
