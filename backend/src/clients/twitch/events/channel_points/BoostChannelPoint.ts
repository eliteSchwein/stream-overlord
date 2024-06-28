import BaseChannelPoint from "./BaseChannelPoint";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {getConfig} from "../../../../helper/ConfigHelper";
import getWebsocketServer from "../../../../App";
import {sleep} from "../../../../../../helper/GeneralHelper";

export default class BoostChannelPoint extends BaseChannelPoint {
    title = 'Boost'

    async handle(event: EventSubChannelRedemptionAddEvent) {
        const shipDiagnosticsConfig = getConfig(/api ship_diagnostics/g)[0]

        const websocketServer = getWebsocketServer()

        //websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['a']})

        const shipApiData = await (await fetch(shipDiagnosticsConfig.url)).json()

        if(shipApiData.in_supercruise) {
            if(shipApiData.low_fuel) {
                await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil das Schiff zu wenig Treibstoff hat.", "low_fuel")
                return
            }

            websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['tab']})

            await sleep(15_000)

            websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['tab']})
            
            return
        }

        if(shipApiData.gear_down) websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['l']})
        if(shipApiData.scoop_deployed) websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['home']})

        await sleep(100)

        websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['tab']})

        await sleep(100)

        if(shipApiData.gear_down) websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['l']})
        if(shipApiData.scoop_deployed) websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['home']})
    }
}