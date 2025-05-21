import parseConfig from "js-conf-parser";
import TwitchClient from "../clients/twitch/Client";
import {logRegular} from "./LogHelper";

let config = {}
let primaryChannel = undefined

export default function readConfig() {
    config = parseConfig(`${__dirname}/../..`, ".env.conf")
}

export function getConfig(filter: RegExp|undefined = undefined, asObject = false) {
    if(!filter) return config

    const result: any = []

    for (const key in config) {
        if(!key.match(filter)) {
            continue
        }

        if(asObject) {
            const realKey = key.replace(filter, '')
            result[realKey] = config[key]
        } else {
            result.push(config[key])
        }
    }

    return result
}

export function getAssetConfig(asset: string) {
    return getConfig(/asset /g, true)[asset]
}

export async function loadPrimaryChannel(client: TwitchClient) {
    logRegular('fetch primary channel')

    primaryChannel = await client.getBot().api.users.getUserByName(
        getConfig(/twitch/g)[0]['channels'][0])
}

export function getPrimaryChannel() {
    return primaryChannel
}