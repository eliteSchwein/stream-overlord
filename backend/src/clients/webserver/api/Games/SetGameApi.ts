import BaseApi from "../BaseApi";
import {getTwitchClient} from "../../../../App";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";

export default class SetGameApi extends BaseApi {
    endpoint = 'game/set'
    post = true

    async handle(req: Request) {
        const body = req.body as any

        if(!body.game_id) {
            return {
                error: 'game_id missing',
                status: 400
            }
        }

        const twitchBot = getTwitchClient().getBot()
        const gameId = body.game_id

        const game = await twitchBot.api.games.getGameById(gameId)

        if(!game) {
            return {
                error: 'game_id invalid',
                status: 400
            }
        }

        const primaryChannel = getPrimaryChannel()

        await twitchBot.api.channels.updateChannelInfo(primaryChannel, {
            gameId: game.id
        })

        return {
            status: 200
        }
    }
}