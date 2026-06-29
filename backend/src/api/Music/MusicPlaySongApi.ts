import BaseApi from '../../abstracts/BaseApi'
import {playSong} from '../../helper/MusicHelper'

export default class MusicPlaySongApi extends BaseApi {
    restEndpoint = 'music/play_song'
    restPost = true
    websocketMethod = 'music_play_song'

    async handle(data: any) {
        const played = await playSong(data ?? {})

        return {
            status: played ? 'okay' : 'error',
        }
    }
}
