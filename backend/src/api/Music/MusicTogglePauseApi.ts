import BaseApi from '../../abstracts/BaseApi'
import { togglePause } from '../../helper/MusicHelper'

export default class MusicTogglePauseApi extends BaseApi {
    restEndpoint = 'music/toggle_pause'
    restPost = false
    websocketMethod = 'music_toggle_pause'

    async handle(data: any) {
        await togglePause()

        return {
            status: 'okay',
        }
    }
}
