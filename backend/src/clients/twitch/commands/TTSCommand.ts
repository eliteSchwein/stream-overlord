import BaseCommand from "./BaseCommand";
import { BotCommandContext } from "@twurple/easy-bot";
import { calculateTTSduration } from "../../../helper/TTShelper";
import { addAlert } from "../../../helper/AlertHelper";
import { v4 as uuidv4 } from "uuid";
import { isThrottled } from "../../../helper/ThrottleHelper";

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

function cleanTtsText(text: string, context: BotCommandContext): string {
    return stripLikelyThirdPartyEmotes(
        stripUnicodeEmojis(stripTwitchEmotesByName(text, context))
    )
        .replace(/\s+/g, " ")
        .trim();
}

export default class TTSCommand extends BaseCommand {
    command = "tts";
    enforceSame = true;
    requiresMod = true;
    params = [
        {
            name: "text",
            type: "all",
        },
    ];

    async handle(params: any, context: BotCommandContext) {
        if (isThrottled()) {
            await context.reply("Das Bot System ist gerade überlastet und kann TTS nicht verarbeiten!");
            return;
        }

        const text = cleanTtsText(String(params.text ?? ""), context).trim();

        if(text === "") {
            await this.replyCommandError(context, "Du musst einen Text angeben!")
            return
        }

        const message = `${context.userName} sagt ${text}`;

        addAlert({
            dummy: true,
            duration: calculateTTSduration(message),
            icon: "",
            message,
            "event-uuid": `Nachricht vorlesen CMD_${uuidv4()}`,
            speak: true,
        });
    }
}