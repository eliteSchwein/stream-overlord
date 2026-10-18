import BaseApi from "../../abstracts/BaseApi";
import {removeSongRequest} from "../../helper/MusicHelper";

export default class SongRequestRemoveApi extends BaseApi {
    restEndpoint = "music/song-requests/remove";
    restPost = true;
    websocketMethod = "music_song_request_remove";

    async handle(data: any) {
        try {
            return await removeSongRequest({
                id: data?.id,
                url: data?.url ?? data?.query,
                index:
                    data?.index !== undefined
                        ? Number(data.index)
                        : undefined,
            });
        } catch (error: any) {
            return {
                error: true,
                message:
                    error?.message
                    ?? "failed to remove song request",
            };
        }
    }
}
