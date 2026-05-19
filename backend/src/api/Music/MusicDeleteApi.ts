import BaseApi from '../../abstracts/BaseApi'
import {deleteSong} from "../../helper/MusicHelper";

export default class MusicDeleteApi extends BaseApi {
    restEndpoint = 'music/delete'
    restPost = true
    websocketMethod = 'music_delete'

    async handle(data: any) {
        try {
            return {
                status: 'okay',
                ...(await deleteSong(data.filename)),
            }
        } catch (error) {
            return {
                error: true,
                message: error?.message ?? 'delete failed',
            }
        }
    }
}