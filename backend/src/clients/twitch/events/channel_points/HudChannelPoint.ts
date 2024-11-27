import BaseChannelPoint from "./BaseChannelPoint";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {getAssetConfig, getConfig} from "../../../../helper/ConfigHelper";
import getWebsocketServer from "../../../../App";
import {sleep} from "../../../../../../helper/GeneralHelper";
import {addAlert, isAlertActive} from "../../../../helper/AlertHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";

export default class HudChannelPoint extends BaseChannelPoint {
    title = 'Hud Surge'

    async handle(event: EventSubChannelRedemptionAddEvent) {
        const theme = getAssetConfig('hud')

        const websocketServer = getWebsocketServer()

        const isActive = addAlert({
            'channel': 'power',
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `HUD Fuse blown`,
            'event-uuid': this.title,
            'video': theme.video
        })

        if(!isActive) {
            await waitUntil(() => isAlertActive(this.title), {timeout: Number.POSITIVE_INFINITY})
        }

        websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['ctrl_left', 'alt_left', 'g']})

        await sleep(15_000)

        websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['ctrl_left', 'alt_left', 'g']})
    }
}