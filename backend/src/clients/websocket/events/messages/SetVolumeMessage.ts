import BaseMessage from "./BaseMessage";
import {setVolume} from "../../../../helper/AudioHelper";

export default class SetVolumeMessage extends BaseMessage {
    method = 'set_volume'

    async handle(data: any) {
        if(!data['interface']) return

        await setVolume(data['interface'], data['volume'])
    }
}