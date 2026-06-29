import BaseApi from "../../abstracts/BaseApi";
import {getStatus, toggleSongRequest} from "../../helper/MusicHelper";

export default class MusicSongRequestToggleApi extends BaseApi {
    restEndpoint = 'music/songrequest/toggle'
    restPost = true
    websocketMethod = 'music_songrequest_toggle'

    async handle(data: any) {
        const enabled = await toggleSongRequest()

        return {
            status: 'okay',
            enabled,
            songrequest: getStatus(),
        }
    }
}