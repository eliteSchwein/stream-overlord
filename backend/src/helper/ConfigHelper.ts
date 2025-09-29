import parseConfig from "js-conf-parser";
import TwitchClient from "../clients/twitch/Client";
import {logNotice, logRegular, logSuccess, logWarn} from "./LogHelper";
import {watchFile, writeFileSync} from "node:fs";
import loadMacros from "./MacroHelper";
import getWebsocketServer, {getOBSClient, getTwitchClient} from "../App";
import registerPermissions from "../clients/twitch/helper/PermissionHelper";
import {fetchGameInfo} from "./GameHelper";
import {initAudio} from "./AudioHelper";
import {readFileSync} from "fs";
import * as path from "node:path";

let config = {}
let primaryChannel = undefined

export default function readConfig(standalone = false) {
    if(standalone) return parseConfig(`${__dirname}/../..`, ".env.conf")
    config = parseConfig(`${__dirname}/../..`, ".env.conf")
}

export function getRawConfig() {
    return readFileSync(path.resolve(`${__dirname}/../..`, ".env.conf"), "utf8")
}

export function writeRawConfig(content: string) {
    writeFileSync(path.resolve(`${__dirname}/../..`, ".env.conf"), content, "utf8")
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

export function getFullConfig() {
    return config
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
                try {
                    await getOBSClient().connect()
                } catch (error) {}
                logSuccess('reload finished')

                getWebsocketServer().send("notify_config_update", {data: getRawConfig()})
            } catch (error) {
                logWarn(`reload failed:`)
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
        }
    )
}