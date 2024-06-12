import {getConfig} from "../../../helper/ConfigHelper";

const activeEvents = {}

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

// todo: remove method here

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}