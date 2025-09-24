import parseConfig from "js-conf-parser";
import TwitchClient from "../clients/twitch/Client";
import {logNotice, logRegular, logSuccess, logWarn} from "./LogHelper";
import {watchFile} from "node:fs";
import loadMacros from "./MacroHelper";
import {getTwitchClient} from "../App";
import registerPermissions from "../clients/twitch/helper/PermissionHelper";
import {fetchGameInfo} from "./GameHelper";
import {initAudio} from "./AudioHelper";

let config = {}
let primaryChannel = undefined

export default function readConfig(standalone = false) {
    if(standalone) return parseConfig(`${__dirname}/../..`, ".env.conf")
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

export function watchConfig() {
    logRegular('watch config file')

    watchFile(
        `${__dirname}/../../.env.conf`,
        {
            persistent: true,
            interval: 100
        },
        async (curr, prev) => {
            try {
                logNotice("config update detected")
                config = readConfig(true)

                await initAudio()

                await getTwitchClient().connect()
                await registerPermissions(getTwitchClient().getBot())
                loadMacros()
                await fetchGameInfo()
                logSuccess('reload finished')
            } catch (error) {
                logWarn(`reload failed:`)
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
        }
    )
}