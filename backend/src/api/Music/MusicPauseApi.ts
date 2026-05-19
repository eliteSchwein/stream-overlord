import BaseApi from '../../abstracts/BaseApi'
import {pause} from "../../helper/MusicHelper";

export default class MusicPauseApi extends BaseApi {
    restEndpoint = 'music/pause'
    restPost = false
    websocketMethod = 'music_pause'

    async handle(data: any) {
        await pause()

        return {
            status: 'okay',
        }
    }
}