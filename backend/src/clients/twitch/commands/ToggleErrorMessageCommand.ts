import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {isShowErrorMessage, setShowErrorMessage} from "../../../helper/CommandHelper";
import {translate} from "../../../helper/LocaleHelper";

export default class ToggleErrorMessageCommand extends BaseCommand {
    command = 'toggleerror'
    requiresMod = true
    enforceSame = true

    async handle(params: any, context: BotCommandContext) {
        const newState = !isShowErrorMessage()

        setShowErrorMessage(newState)

        if(newState) {
            await context.reply(translate("errors.enabled"))
            return
        }

        await context.reply(translate("errors.disabled"))
    }
}