import BaseApi from '../../abstracts/BaseApi'
import {show} from "../../helper/MusicHelper";

export default class MusicShowApi extends BaseApi {
    restEndpoint = 'music/show'
    restPost = false
    websocketMethod = 'music_show'

    async handle(data: any) {
        show()

        return {
            status: 'okay',
        }
    }
}