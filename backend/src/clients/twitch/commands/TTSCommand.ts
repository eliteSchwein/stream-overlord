import BaseCommand from "./BaseCommand";
import { BotCommandContext } from "@twurple/easy-bot";
import { calculateTTSduration } from "../../../helper/TTShelper";
import { addAlert } from "../../../helper/AlertHelper";
import { v4 as uuidv4 } from "uuid";
import { isThrottled } from "../../../helper/ThrottleHelper";
import {stripEmotes} from "../../../helper/DataHelper";

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

        const text = stripEmotes(String(params.text ?? ""), context).trim();

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