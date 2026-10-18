import BaseApi from "../../abstracts/BaseApi";
import {getSongRequestUpdatePayload} from "../../helper/MusicHelper";

export default class SongRequestsApi extends BaseApi {
    restEndpoint = "music/song-requests";
    restPost = false;
    websocketMethod = "music_song_requests";

    async handle() {
        return getSongRequestUpdatePayload();
    }
}
