import BaseApi from '../../abstracts/BaseApi'
import { deleteRegularMusicFile } from '../../helper/MusicHelper'

export default class MusicPlaylistDeleteApi extends BaseApi {
    restEndpoint = 'music/playlist/delete'
    restPost = true
    websocketMethod = 'music_playlist_delete'

    async handle(data: any) {
        try {
            return {
                status: 'okay',
                ...(await deleteRegularMusicFile(data.filename)),
            }
        } catch (error) {
            return {
                error: true,
                message: error?.message ?? 'delete failed',
            }
        }
    }
}