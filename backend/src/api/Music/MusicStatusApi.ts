import BaseApi from '../../abstracts/BaseApi'
import {getStatus, sync} from '../../helper/MusicHelper'

export default class MusicStatusApi extends BaseApi {
    restEndpoint = 'music/status'
    restPost = false
    websocketMethod = 'music_status'

    async handle(data: any) {
        await sync()

        return getStatus()
    }
}