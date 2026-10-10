import {get} from "lodash";
import {getGameInfoData} from "../clients/website/WebsiteClient";
import {getTwitchClient} from "../App";
import {getPrimaryChannel} from "./ConfigHelper";
import {BotCommandContext} from "@twurple/easy-bot";
import {stripLikelyThirdPartyEmotes, stripTextEmoticons, stripUnicodeEmojis} from "./EmojiHelper";


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
    const pct = (done / total) * 100
    const rounded = Math.round(pct * 1000) / 1000

    return Math.max(0, Math.min(100, rounded))
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTwitchEmoteNames(context: BotCommandContext): string[] {
    const msg = (context as any).msg;
    const fullText = String(msg?.text ?? "");
    const emoteOffsets: Map<string, string[]> | undefined = msg?.emoteOffsets;

    if (!fullText || !emoteOffsets || emoteOffsets.size === 0) {
        return [];
    }

    const emoteNames = new Set<string>();

    for (const offsets of emoteOffsets.values()) {
        for (const offset of offsets) {
            const [start, end] = offset.split("-").map(Number);

            if (Number.isNaN(start) || Number.isNaN(end)) continue;

            const emoteName = fullText.substring(start, end + 1).trim();

            if (emoteName) {
                emoteNames.add(emoteName);
            }
        }
    }

    return [...emoteNames];
}

function stripTwitchEmotesByName(text: string, context: BotCommandContext): string {
    const emoteNames = getTwitchEmoteNames(context);

    if (emoteNames.length === 0) {
        return text;
    }

    let cleaned = text;

    for (const emoteName of emoteNames) {
        cleaned = cleaned.replace(
            new RegExp(`(^|\\s)${escapeRegExp(emoteName)}(?=\\s|$)`, "g"),
            " "
        );
    }

    return cleaned;
}

export function stripEmotes(text: string, context: BotCommandContext): string {
    return stripLikelyThirdPartyEmotes(
        stripTextEmoticons(stripUnicodeEmojis(stripTwitchEmotesByName(text, context)))
    )
        .replace(/\s+/g, " ")
        .trim();
}