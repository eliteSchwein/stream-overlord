import BaseApi from '../../abstracts/BaseApi'
import { setMusicShuffle, toggleMusicShuffle } from '../../helper/MusicHelper'

export default class MusicShuffleApi extends BaseApi {
    restEndpoint = 'music/shuffle'
    restPost = true
    websocketMethod = 'music_shuffle'

    async handle(data: any) {
        if (data?.enabled === undefined && data?.state === undefined) {
            await toggleMusicShuffle()
        } else {
            await setMusicShuffle(data?.enabled ?? data?.state)
        }

        return {
            status: 'okay',
        }
    }
}
