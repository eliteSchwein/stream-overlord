import {getConfig} from "./ConfigHelper";
import getWebsocketServer, {getTwitchClient} from "../App";
import {HelixCustomReward, HelixUser} from "@twurple/api";
import {logError, logRegular, logWarn} from "./LogHelper";
import {getGameInfoData} from "../clients/website/WebsiteClient";

let channelPoints = {}
let activeChannelPoints = []

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

    const newActiveChannelPoints = defaultChannelPoints.concat(gameChannelPointNames);

    const toDisableKeys = Object.keys(channelPoints).filter(item => !newActiveChannelPoints.includes(item))

    const toDisable = toDisableKeys.map(key => channelPoints[key])
    const toEnable = newActiveChannelPoints.map(key => channelPoints[key])

    activeChannelPoints = []

    for (const channelPoint of toDisable) {
        await enableChannelPoint(channelPoint, primaryChannel, false)
    }
    for (const channelPoint of toEnable) {
        activeChannelPoints.push({
            name: channelPoint.title,
            id: channelPoint.id,
            background: channelPoint.backgroundColor,
            image: channelPoint.getImageUrl(4),
            active: true,
        })
        await enableChannelPoint(channelPoint, primaryChannel, true)
    }

    getWebsocketServer()?.send('notify_channel_point_update', activeChannelPoints)
}

async function enableChannelPoint(channelPoint: HelixCustomReward, primaryChannel: HelixUser, enable: boolean) {
    if(channelPoint.isEnabled === enable) return

    const enableMessage = (enable) ? 'enable' : 'disable'

    logRegular(`${enableMessage} channel point ${channelPoint.title}`)

    const bot = getTwitchClient().getBot()

    try {
        await bot.api.channelPoints.updateCustomReward(primaryChannel, channelPoint.id, {
            isPaused: false,
            isEnabled: enable,
        })
    } catch(error) {
        logWarn(`${enableMessage} channel point ${channelPoint.title} failed:`)
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
}

export async function toggleChannelPoint(channelPoint: any, pause = false) {
    const channelPointEntity = channelPoints[channelPoint.name]

    if(!channelPointEntity) {
        return false
    }

    const bot = getTwitchClient().getBot()

    const primaryChannel = await bot.api.users.getUserByName(
        getConfig(/twitch/g)[0]['channels'][0])

    await bot.api.channelPoints.updateCustomReward(primaryChannel, channelPoint.id, {
        isPaused: pause,
    })

    activeChannelPoints.forEach((activeChannelPoint) => {
        if(activeChannelPoint.id !== channelPoint.id) {
            return
        }
        activeChannelPoint.active = !pause;
    })

    getWebsocketServer()?.send('notify_channel_point_update', activeChannelPoints)

    return true
}

export function getChannelPointMapping() {
    return channelPoints
}

export function getActiveChannelPoints() {
    return activeChannelPoints
}