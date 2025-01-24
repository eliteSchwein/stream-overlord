import {getConfig} from "../../../helper/ConfigHelper";
import {removeAlert} from "../../../helper/AlertHelper";

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
    return activeEvents[name][channel].length > limit
}

export function addEventToCooldown(randomHash: string, name: string, channel: string) {
    activeEvents[name][channel].push(randomHash)
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
    removeAlert({
        'event-uuid': randomHash
    })
}

export function removeEventFromCooldown(randomHash: string, name: string, channel: string) {
    const array = activeEvents[name][channel]

    const index = array.indexOf(randomHash)
    if (index > -1) {
        array.splice(index, 1)
    }

    activeEvents[name][channel] = array
}