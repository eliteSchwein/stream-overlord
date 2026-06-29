import BaseApi from '../../abstracts/BaseApi'
import {setMusicLoop, toggleMusicLoop} from '../../helper/MusicHelper'

export default class MusicLoopApi extends BaseApi {
    restEndpoint = 'music/loop'
    restPost = true
    websocketMethod = 'music_loop'

    async handle(data: any) {
        if (data?.enabled === undefined && data?.state === undefined) {
            await toggleMusicLoop()
        } else {
            await setMusicLoop(data?.enabled ?? data?.state)
        }

        return {
            status: 'okay',
        }
    }
}
