import BaseApi from '../../abstracts/BaseApi'
import { play } from '../../helper/MusicHelper'

export default class MusicPlayApi extends BaseApi {
    restEndpoint = 'music/play'
    restPost = false
    websocketMethod = 'music_play'

    async handle(data: any) {
        await play()

        return {
            status: 'okay',
        }
    }
}