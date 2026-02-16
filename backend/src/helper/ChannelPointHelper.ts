import {getConfig, getPrimaryChannel} from "./ConfigHelper";
import getWebsocketServer, {getTwitchClient} from "../App";
import {HelixCustomReward, HelixUser} from "@twurple/api";
import {logRegular, logWarn} from "./LogHelper";
import {getGameInfoData} from "../clients/website/WebsiteClient";

let channelPoints = {}
let activeChannelPoints = []
let gameKeyCombos = {}

export async function fetchChannelPointData() {
    const bot = getTwitchClient().getBot()
    const primaryChannel = getPrimaryChannel()

    const channelPointsData = await bot.api.channelPoints.getCustomRewards(primaryChannel.id)

    for(const channelPoint of channelPointsData) {
        channelPoints[channelPoint.title] = channelPoint
    }
}

export async function updateChannelPoints() {
    await fetchChannelPointData()

    const gameData = await getGameInfoData()
    const bot = getTwitchClient().getBot()
    const primaryChannel = getPrimaryChannel()

    const defaultChannelPoints = getConfig(/defaults/g)?.[0]?.['channel_points'] ?? []

    gameKeyCombos = {}

    const gameChannelPoints = Array.isArray(gameData?.channel_points)
        ? gameData!.channel_points
        : [];

    const gameChannelPointNames = gameChannelPoints
        .map((point: any) => point?.name)
        .filter((n: any): n is string => typeof n === "string" && n.length > 0);

    for(const channelPoint of gameChannelPoints) {
        if(!gameKeyCombos[channelPoint.name]) {
            gameKeyCombos[channelPoint.name] = []
        }

        for(const keyCombo of channelPoint.keyboard_combos) {
            gameKeyCombos[channelPoint.name].push(keyCombo)
        }
    }

    const newActiveChannelPoints = defaultChannelPoints.concat(gameChannelPointNames);

    const toDisableKeys = Object.keys(channelPoints).filter(item => !newActiveChannelPoints.includes(item))

    const toDisable = toDisableKeys.map(key => channelPoints[key])
    const toEnable = newActiveChannelPoints.map(key => channelPoints[key])

    activeChannelPoints = []

    for (const channelPoint of toDisable) {
        await enableChannelPoint(channelPoint, primaryChannel, false)
    }
    for (const channelPoint of toEnable) {
        if(!channelPoint) continue

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

export function updateActiveChannelPoint(id: string, isActive: boolean) {
    const index = activeChannelPoints.findIndex(reward => reward.id === id);
    const reward = activeChannelPoints[index];

    if(!reward) return

    reward.active = isActive;

    activeChannelPoints[index] = reward;

    getWebsocketServer()?.send('notify_channel_point_update', activeChannelPoints)
}

export async function toggleChannelPoint(channelPoint: any, pause = false) {
    const channelPointEntity = channelPoints[channelPoint.name]

    if(!channelPointEntity) {
        return false
    }

    const bot = getTwitchClient().getBot()

    const primaryChannel = getPrimaryChannel()

    await bot.api.channelPoints.updateCustomReward(primaryChannel, channelPoint.id, {
        isPaused: pause,
    })

    activeChannelPoints.forEach((activeChannelPoint) => {
        if(activeChannelPoint.id !== channelPoint.id) {
            return
        }
        activeChannelPoint.active = !pause;
    })

    return true
}

export function getChannelPointMapping() {
    return channelPoints
}

export function getActiveChannelPoints() {
    return activeChannelPoints
}

export function getKeyCombos(rewardName: string) {
    return gameKeyCombos[rewardName]
}