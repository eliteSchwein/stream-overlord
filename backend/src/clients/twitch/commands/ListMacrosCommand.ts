import BaseCommand from "./BaseCommand";
import {getMacros} from "../../../helper/MacroHelper";

export class ListMacrosCommand extends BaseCommand {
    command = 'listmacros'
    requiresMod = true
    enforceSame = true
    aliases = ['macros']

    async handle(params: any, context: any) {
        const macros = getMacros()

        if(Object.keys(macros).length === 0) {
            await this.replyCommandError(context, "Es wurden keine Macro gefunden.")
            return
        }

        await context.reply('Liste der Makros:')

        let macroList = ''
        let counter = 0

        for(const macro in macros) {
            if(counter > 5) {
                await context.reply(macroList.trim().substring(3))
                macroList = ""
                counter = 0
            }
            macroList = `${macroList} || ${macro}`

            counter++
        }
        if(macroList !== "") {
            await context.reply(macroList.trim().substring(3))
        }
    }
}