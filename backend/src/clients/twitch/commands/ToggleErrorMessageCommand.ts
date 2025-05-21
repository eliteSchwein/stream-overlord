import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {isShowErrorMessage, setShowErrorMessage} from "../../../helper/CommandHelper";

export default class ToggleErrorMessageCommand extends BaseCommand {
    command = 'toggleerror'
    requiresMod = true
    enforceSame = true

    async handle(params: any, context: BotCommandContext) {
        const newState = !isShowErrorMessage()

        setShowErrorMessage(newState)

        if(newState) {
            await context.reply("Fehlermeldungen (z.B. bei fehlender Berechtigung) werden nun wieder in den Chat gepostet.")
            return
        }

        await context.reply("Fehlermeldungen (z.B. bei fehlender Berechtigung) werden nun nicht mehr in den Chat gepostet.")
    }
}