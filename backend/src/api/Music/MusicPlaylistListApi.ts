import BaseApi from '../../abstracts/BaseApi'
import {getRegularMusicFiles} from "../../helper/MusicHelper";

export default class MusicPlaylistListApi extends BaseApi {
    restEndpoint = 'music/playlist'
    restPost = false
    websocketMethod = 'music_playlist'

    async handle(data: any) {
        return {
            status: 'okay',
            files: getRegularMusicFiles(),
        }
    }
}