import {Bot} from "@twurple/easy-bot";
import {getConfig} from "../../../helper/ConfigHelper";

const moderators = {}
const vips = {}

export default async function registerPermissions(bot: Bot) {
    const channels = getConfig(/twitch/g)[0]['channels']

    for(const channel of channels) {
        moderators[channel] = []
        vips[channel] = []

        const channelMods = await bot.getMods(channel)
        const channelVips = await bot.getVips(channel)

        for (const channelMod of channelMods) {
            moderators[channel].push(channelMod.userId)
        }

        for (const channelVip of channelVips) {
            vips[channel].push(channelVip.id)
        }
    }
}

export function registerPermissionInterval(bot: Bot) {
    setInterval(() => {
        void registerPermissions(bot)
    }, 60 * 1000)
}

export function hasVip(channel: string, userId: string): boolean {
    if(!vips[channel]) return false

    return vips[channel].includes(`${userId}`)
}

export function hasModerator(channel: string, userId: string): boolean {
    if(!moderators[channel]) return false

    return moderators[channel].includes(`${userId}`)
}