import BaseChannelPoint from "./BaseChannelPoint";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {getAssetConfig, getConfig} from "../../../../helper/ConfigHelper";
import getWebsocketServer from "../../../../App";
import {sleep} from "../../../../../../helper/GeneralHelper";
import {addAlert, isAlertActive} from "../../../../helper/AlertHelper";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import { calculateTTSduration } from "../../../../helper/TTShelper";

export default class TTSChannelPoint extends BaseChannelPoint {
    title = 'Nachricht vorlesen'
    input = true

    async handle(event: EventSubChannelRedemptionAddEvent) {
        const message = `${event.userName} sagt ${event.input}`
        addAlert({
            'dummy': true,
            'duration': calculateTTSduration(message),
            'icon': '',
            'message': message,
            'event-uuid': this.eventUuid,
            'speak': true
        })
    }
}