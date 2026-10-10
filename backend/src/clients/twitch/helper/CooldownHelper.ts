import {getConfig} from "../../../helper/ConfigHelper";

const activeEvents = {}
const queriedEvents = []

export default function registerEventCooldown(name: string) {
    if(!activeEvents[name]){
        activeEvents[name] = {};
    }

    const channels = getConfig(/twitch/g)[0]['channels']

    for (const channel of channels) {
        activeEvents[name][channel] = []
    }
}

export function isEventFull(name: string, channel: string, limit: number): boolean {
    const active = activeEvents[name]?.[channel] ?? [];
    return active.length >= limit;
}

export function addEventToCooldown(randomHash: string, name: string, channel: string) {
    if (!activeEvents[name]) activeEvents[name] = {};
    if (!activeEvents[name][channel]) activeEvents[name][channel] = [];
    activeEvents[name][channel].push(randomHash);
}

export function hasEventHash(randomHash: string, name: string, channel: string) {
    return activeEvents[name][channel].contains(randomHash)
}

export function queryEvent(randomHash: string) {
    queriedEvents.push(randomHash)
}

export function isEventQueried(randomHash: string) {
    return queriedEvents.includes(randomHash)
}

export function removeEventFromQuery(randomHash: string) {
    const index = queriedEvents.indexOf(randomHash);
    if (index > -1) {
        queriedEvents.splice(index, 1);
    }
}

export function removeEventFromCooldown(randomHash: string, name: string, channel: string) {
    const array = activeEvents[name]?.[channel];
    if (!array) return;

    const index = array.indexOf(randomHash)
    if (index > -1) {
        array.splice(index, 1)
    }

    activeEvents[name][channel] = array
}