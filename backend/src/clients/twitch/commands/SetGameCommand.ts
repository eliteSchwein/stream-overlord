import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {getConfig} from "../../../helper/ConfigHelper";
import {logRegular} from "../../../helper/LogHelper";

export default class SetGameCommand extends BaseCommand {
    command = 'setgame'
    requiresMod = true
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

        const primaryChannel = await this.bot.api.users.getUserByName(
            getConfig(/twitch/g)[0]['channels'][0])

        await this.bot.api.channels.updateChannelInfo(primaryChannel, {
            gameId: game.id
        })
    }
}