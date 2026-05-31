import BaseApi from '../../abstracts/BaseApi'
import { setVolume } from '../../helper/MusicHelper'

export default class MusicVolumeApi extends BaseApi {
    restEndpoint = 'music/volume'
    restPost = true
    websocketMethod = 'music_volume'

    async handle(data: any) {
        const volume = Number(data?.volume ?? data?.value)

        if (!Number.isFinite(volume)) {
            return {
                status: 'error',
                message: 'volume missing',
            }
        }

        await setVolume(Math.max(0, Math.min(100, volume)))

        return {
            status: 'okay',
        }
    }
}
