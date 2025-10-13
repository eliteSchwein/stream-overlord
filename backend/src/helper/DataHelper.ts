import {get} from "lodash";
import {getGameInfoData} from "../clients/website/WebsiteClient";
import {getTwitchClient} from "../App";
import {getPrimaryChannel} from "./ConfigHelper";


export async function parsePlaceholders(content: string, additional: any = {}) {
    const placeholders = content.matchAll(/(\${).*?}/g)

    const primaryChannel = getPrimaryChannel()
    const twitchClient = getTwitchClient()

    const streamInfo = await primaryChannel.getStream()
    const gameInfo = await getGameInfoData()
    const channelInfo = await twitchClient.getBot().api.channels.getChannelInfoById(primaryChannel.id)

    const fullData = {
        primaryChannel: primaryChannel,
        gameInfo: gameInfo,
        streamInfo: streamInfo,
        channelInfo: channelInfo,
        additional: additional
    }

    for (const placeholder of placeholders) {
        const placeholderId = String(placeholder).match(/(\${).*?}/g)[0]
            .replace(/(\${)/g, '')
            .replace(/}/g, '')

        let data = get(fullData, placeholderId)
        if(!data) data = null

        content = content.replace("${"+placeholderId+"}", data)
    }

    return content
}

export function calcProgress(current: number, max: number) {
    const total = max ?? 0
    if (total <= 0) return 100
    const done = total - (current ?? 0)
    const pct = Math.round((done / total) * 100)
    return Math.max(0, Math.min(100, pct))
}