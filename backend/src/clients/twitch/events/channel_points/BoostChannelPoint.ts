import BaseChannelPoint from "./BaseChannelPoint";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {getConfig} from "../../../../helper/ConfigHelper";
import getWebsocketServer from "../../../../App";

export default class BoostChannelPoint extends BaseChannelPoint {
    title = 'Boost'

    async handle(event: EventSubChannelRedemptionAddEvent) {
        const shipDiagnosticsConfig = getConfig(/api ship_diagnostics/g)[0]

        const websocketServer = getWebsocketServer()

        websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['A']})

        const shipApiData = await (await fetch(shipDiagnosticsConfig.url)).json()

        // todo: i need a keyboard esp thingi to continue

    }
}