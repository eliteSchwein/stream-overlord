import BaseApi from '../../abstracts/BaseApi'
import {next} from '../../helper/MusicHelper'

export default class MusicNextApi extends BaseApi {
    restEndpoint = 'music/next'
    restPost = false
    websocketMethod = 'music_next'

    async handle(data: any) {
        await next()

        return {
            status: 'okay',
        }
    }
}