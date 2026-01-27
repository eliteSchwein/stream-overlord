import BaseChannelPoint from "./BaseChannelPoint";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {getAssetConfig, getConfig} from "../../../../helper/ConfigHelper";
import getWebsocketServer from "../../../../App";
import {sleep} from "../../../../../../helper/GeneralHelper";
import {addAlert, isAlertActive} from "../../../../helper/AlertHelper";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";

export default class HudChannelPoint extends BaseChannelPoint {
    title = 'Hud Surge'

    async handle(event: EventSubChannelRedemptionAddEvent) {
        const theme = getAssetConfig('hud')

        const websocketServer = getWebsocketServer()

        const shipDiagnosticsConfig = getConfig(/api ship_diagnostics/g)[0]

        const shipApiData = await (await fetch(shipDiagnosticsConfig.url)).json()

        const isActive = addAlert({
            'channel': 'power',
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `HUD Fuse blown`,
            'event-uuid': this.eventUuid,
            'video': theme.video,
            'lamp_color': theme.lamp_color,
            'volume': theme.volume,
        })

        if(!isActive) {
            await waitUntil(() => isAlertActive(this.title), {timeout: WAIT_FOREVER})
        }

        websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['ctrl_left', 'alt_left', 'g']})

        await sleep(15_000)

        websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['ctrl_left', 'alt_left', 'g']})
    }
}