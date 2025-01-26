import { getGameInfoData } from "../../website/WebsiteClient";
import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";

export default class GetGameCommand extends BaseCommand{
    command = 'get_game'
    aliases = ['buy_game']

    async handle(params: any, context: BotCommandContext) {
        const gameData = await getGameInfoData()

        void context.say(`Hier kannst du das Spiel kaufen: ${gameData.shop_url}`)
    }
}