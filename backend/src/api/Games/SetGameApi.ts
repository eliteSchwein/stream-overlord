import BaseApi from "../../abstracts/BaseApi";
import {getTwitchClient} from "../../App";
import {getPrimaryChannel} from "../../helper/ConfigHelper";

export default class SetGameApi extends BaseApi {
    restEndpoint = 'games/set'
    restPost = true
    websocketMethod = 'set_game'

    async handle(data: any): Promise<any>
    {
        if(!data.game_id) return {"error": "missing game id"}

        const twitchBot = getTwitchClient().getBot()
        const gameId = data.game_id

        const game = await twitchBot.api.games.getGameById(gameId)

        if(!game) return {"error": "game_id invalid"}

        const primaryChannel = getPrimaryChannel()

        await twitchBot.api.channels.updateChannelInfo(primaryChannel, {
            gameId: game.id
        })
    }
}