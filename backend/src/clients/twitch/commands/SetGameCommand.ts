import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {getPrimaryChannel} from "../../../helper/ConfigHelper";
import {logRegular} from "../../../helper/LogHelper";
import {translate} from "../../../helper/LocaleHelper";

export default class SetGameCommand extends BaseCommand {
    command = 'setgame'
    requiresMod = true
    enforceSame = true
    params = [
        {
            name: 'gameName',
            label: 'game',
            type: 'all'
        },
    ]

    async handle(params: any, context: BotCommandContext) {
        const game = await this.bot.api.games.getGameByName(params.gameName)

        if(!game) {
            await context.reply(translate("game.not_found"))
            return
        }

        logRegular(`update game to ${game.name}`)

        const primaryChannel = getPrimaryChannel()

        await this.bot.api.channels.updateChannelInfo(primaryChannel, {
            gameId: game.id
        })
    }
}