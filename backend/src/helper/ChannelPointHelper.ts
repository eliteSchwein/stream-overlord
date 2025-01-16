import {getConfig} from "./ConfigHelper";
import {getTwitchClient} from "../App";
import {HelixCustomReward, HelixUser} from "@twurple/api";
import {logError, logRegular, logWarn} from "./LogHelper";
import {getGameInfoData} from "../clients/website/WebsiteClient";

let channelPoints = {}

export async function fetchChannelPointData() {
    const bot = getTwitchClient().getBot()
    const primaryChannel = await bot.api.users.getUserByName(
        getConfig(/twitch/g)[0]['channels'][0])

    const channelPointsData = await bot.api.channelPoints.getCustomRewards(primaryChannel.id)

    for(const channelPoint of channelPointsData) {
        channelPoints[channelPoint.title] = channelPoint
    }
}

export async function updateChannelPoints() {
    await fetchChannelPointData()

    const gameData = await getGameInfoData()
    const bot = getTwitchClient().getBot()
    const primaryChannel = await bot.api.users.getUserByName(
        getConfig(/twitch/g)[0]['channels'][0])

    const defaultChannelPoints = getConfig(/defaults/g)[0]['channel_points']

    const gameChannelPoints = gameData.channel_points;
    const gameChannelPointNames = gameChannelPoints.map(point => point.name);

    const activeChannelPoints = defaultChannelPoints.concat(gameChannelPointNames);

    const toDisableKeys = Object.keys(channelPoints).filter(item => !activeChannelPoints.includes(item))

    const toDisable = toDisableKeys.map(key => channelPoints[key])
    const toEnable = activeChannelPoints.map(key => channelPoints[key])

    for (const channelPoint of toDisable) {
        await enableChannelPoint(channelPoint, primaryChannel, false)
    }
    for (const channelPoint of toEnable) {
        await enableChannelPoint(channelPoint, primaryChannel, true)
    }
}

async function enableChannelPoint(channelPoint: HelixCustomReward, primaryChannel: HelixUser, enable: boolean) {
    if(channelPoint.isEnabled === enable) return

    const enableMessage = (enable) ? 'enable' : 'disable'

    logRegular(`${enableMessage} channel point ${channelPoint.title}`)

    const bot = getTwitchClient().getBot()

    try {
        await bot.api.channelPoints.updateCustomReward(primaryChannel, channelPoint.id, {
            isEnabled: enable,
        })
    } catch(error) {
        logWarn(`${enableMessage} channel point ${channelPoint.title} failed:`)
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
}

export function getChannelPointMapping() {
    return channelPoints
}