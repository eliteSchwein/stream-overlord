import BaseApi from "../../abstracts/BaseApi";
import {back} from "../../helper/MusicHelper";

export default class MusicBackApi extends BaseApi {
    restEndpoint = 'music/back'
    restPost = false
    websocketMethod = 'music_back'

    async handle(data: any) {
        await back()

        return {
            status: 'okay',
        }
    }
}