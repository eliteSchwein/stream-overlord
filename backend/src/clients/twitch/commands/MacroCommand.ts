import BaseCommand from "./BaseCommand";
import {isMacroPresent, triggerMacro} from "../../../helper/MacroHelper";

export default class MacroCommand extends BaseCommand {
    command = 'macro'
    requiresBroadcaster = true
    params = [
        {
            name: 'macro',
            type: 'string'
        }
    ]

    async handle(params: any, context: any) {
        const targetMacro = params.macro

        if(!isMacroPresent(targetMacro)) {
            await this.replyCommandError(context, 'Das angebene Macro wurde nicht gefunden.')
            return
        }

        await context.reply(`Das Macro ${targetMacro} wird nun ausgelöst.`)

        await triggerMacro(targetMacro)

        await context.reply(`Das Macro ${targetMacro} ist nun durchgelaufen.`)
    }
}