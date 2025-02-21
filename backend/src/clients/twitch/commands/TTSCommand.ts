import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {calculateTTSduration} from "../../../helper/TTShelper";
import {addAlert} from "../../../helper/AlertHelper";
import {v4 as uuidv4} from "uuid";

export default class TTSCommand extends BaseCommand {
    command = 'tts'
    requiresMod = true
    params = [
        {
            name: 'text',
            type: 'string'
        },
    ]

    async handle(params: any, context: BotCommandContext) {
        const message = `${context.userName} sagt ${params.text}`
        addAlert({
            'dummy': true,
            'duration': calculateTTSduration(message),
            'icon': '',
            'message': message,
            'event-uuid': `Nachricht vorlesen CMD_${uuidv4()}`,
            'speak': true
        })
    }
}