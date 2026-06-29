import BaseApi from '../../abstracts/BaseApi'
import {setMusicLoopFile, toggleMusicLoopFile} from '../../helper/MusicHelper'

export default class MusicLoopFileApi extends BaseApi {
    restEndpoint = 'music/loop_file'
    restPost = true
    websocketMethod = 'music_loop_file'

    async handle(data: any) {
        if (data?.enabled === undefined && data?.state === undefined) {
            await toggleMusicLoopFile()
        } else {
            await setMusicLoopFile(data?.enabled ?? data?.state)
        }

        return {
            status: 'okay',
        }
    }
}
