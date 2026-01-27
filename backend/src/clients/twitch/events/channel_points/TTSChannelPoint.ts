import BaseChannelPoint from "./BaseChannelPoint";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {addAlert} from "../../../../helper/AlertHelper";
import {calculateTTSduration} from "../../../../helper/TTShelper";
import {isThrottled} from "../../../../helper/ThrottleHelper";

export default class TTSChannelPoint extends BaseChannelPoint {
    title = 'Nachricht vorlesen'
    input = true

    async handle(event: EventSubChannelRedemptionAddEvent) {
        if(isThrottled()) {
            await this.deny(event, 'Das Bot System ist gerade überlastet und kann TTS nicht verarbeiten!', "system_throttled")
            return
        }
        const message = `${event.userName} sagt ${event.input}`
        addAlert({
            'dummy': true,
            'duration': calculateTTSduration(message),
            'icon': '',
            'message': message,
            'event-uuid': this.eventUuid,
            'speak': true,
        })
    }
}