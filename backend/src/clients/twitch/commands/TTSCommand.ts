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

function stripTwitchEmotes(text: string, context: BotCommandContext): string {
    const msg = (context as any).msg;
    const emoteOffsets: Map<string, string[]> | undefined = msg?.emoteOffsets;

    if (!emoteOffsets || emoteOffsets.size === 0) return text;

    const ranges: Array<[number, number]> = [];

    for (const offsets of emoteOffsets.values()) {
        for (const offset of offsets) {
            const [start, end] = offset.split("-").map(Number);

            if (!Number.isNaN(start) && !Number.isNaN(end)) {
                ranges.push([start, end]);
            }
        }
    }

    if (ranges.length === 0) return text;

    return [...text]
        .filter((_, index) => !ranges.some(([start, end]) => index >= start && index <= end))
        .join("");
}

function cleanTtsText(text: string, context: BotCommandContext): string {
    return stripUnicodeEmojis(stripTwitchEmotes(text, context))
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

        const text = cleanTtsText(String(params.text ?? ""), context);
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