import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {getConfig, getPrimaryChannel} from "../../../helper/ConfigHelper";
import {logRegular} from "../../../helper/LogHelper";

export default class SetGameCommand extends BaseCommand {
    command = 'setgame'
    requiresMod = true
    enforceSame = true
    params = [
        {
            name: 'gameName',
            type: 'all'
        },
    ]

    async handle(params: any, context: BotCommandContext) {
        const game = await this.bot.api.games.getGameByName(params.gameName)

        if(!game) {
            await context.reply('Dieses Spiel wurde leider nicht gefunden')
            return
        }

        logRegular(`update game to ${game.name}`)

        const primaryChannel = getPrimaryChannel()

        await this.bot.api.channels.updateChannelInfo(primaryChannel, {
            gameId: game.id
        })
    }
}