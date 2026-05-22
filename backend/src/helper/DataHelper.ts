import {get} from "lodash";
import {getGameInfoData} from "../clients/website/WebsiteClient";
import {getTwitchClient} from "../App";
import {getPrimaryChannel} from "./ConfigHelper";
import {BotCommandContext} from "@twurple/easy-bot";


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

function stripUnicodeEmojis(text: string): string {
    return text
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
        .replace(/[\u{2600}-\u{27BF}]/gu, "")
        .replace(/[\u200D\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, "");
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

function isLikelyThirdPartyEmote(word: string): boolean {
    const cleaned = word.replace(/[.,!?;:()[\]{}"']/g, "");

    if (!cleaned) return false;

    // LUL, KEKW, OMEGALUL, etc.
    if (/^[A-Z0-9]{3,}$/.test(cleaned)) return true;

    // LuL, PoG, etc.
    if (/^[A-Z][a-z]?[A-Z]$/.test(cleaned)) return true;

    // sillyp3Shy, elites64Note, widepeepoHappy, monkaS, etc.
    return (
        /^[a-zA-Z0-9_]{4,}$/.test(cleaned) &&
        /[a-z]/.test(cleaned) &&
        /[A-Z]/.test(cleaned) &&
        (/\d/.test(cleaned) || /[a-z][A-Z]/.test(cleaned))
    );
}

function stripLikelyThirdPartyEmotes(text: string): string {
    return text
        .split(/\s+/)
        .filter((word) => !isLikelyThirdPartyEmote(word))
        .join(" ");
}

export function stripEmotes(text: string, context: BotCommandContext): string {
    return stripLikelyThirdPartyEmotes(
        stripUnicodeEmojis(stripTwitchEmotesByName(text, context))
    )
        .replace(/\s+/g, " ")
        .trim();
}