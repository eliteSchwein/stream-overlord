import BaseApi from '../../abstracts/BaseApi'
import { setRelativeVolume } from '../../helper/MusicHelper'

export default class MusicVolumeRelativeApi extends BaseApi {
    restEndpoint = 'music/volume_relative'
    restPost = true
    websocketMethod = 'music_volume_relative'

    async handle(data: any) {
        const volume = Number(data?.volume ?? data?.value ?? data?.delta)

        if (!Number.isFinite(volume)) {
            return {
                status: 'error',
                message: 'volume missing',
            }
        }

        await setRelativeVolume(volume)

        return {
            status: 'okay',
        }
    }
}
