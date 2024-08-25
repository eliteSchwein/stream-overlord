import BaseChannelPoint from "./BaseChannelPoint";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {getAssetConfig, getConfig} from "../../../../helper/ConfigHelper";
import getWebsocketServer from "../../../../App";
import {sleep} from "../../../../../../helper/GeneralHelper";
import {addAlert} from "../../../../helper/AlertHelper";

export default class FAChannelPoint extends BaseChannelPoint {
    title = 'FlightAssistant'

    async handle(event: EventSubChannelRedemptionAddEvent) {
        const shipDiagnosticsConfig = getConfig(/api ship_diagnostics/g)[0]

        const websocketServer = getWebsocketServer()

        const shipApiData = await (await fetch(shipDiagnosticsConfig.url)).json()

        if(!shipApiData.in_ship) {
            await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil ich aktuell nicht in ein Schiff bin.", "not_in_ship")
            return
        }

        if(shipApiData.ship_docked) {
            await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil das Schiff angedockt ist.", "ship_docked")
            return
        }

        if(shipApiData.fsd_jump) {
            await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil im Hyperraum kein FA umschalten aktuell möglich ist.", "in_hyperspace")
            return
        }

        if(shipApiData.in_supercruise) {
            await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil im Supercruise kein FA umschalten aktuell möglich ist.", "in_supercruise")
            return
        }

        const theme = getAssetConfig('flight_assistant')

        const message = (shipApiData.flight_fa_off) ? "FA on" : "FA off"
        const icon = (shipApiData.flight_fa_off) ? "toggle-switch" : "toggle-switch-off-outline"
        const sound = (shipApiData.flight_fa_off) ? "fa-on" : "fa-off"

        addAlert({
            'sound': sound,
            'duration': 5,
            'color': theme.color,
            'icon': icon,
            'message': message,
            'event-uuid': this.title,
            'video': theme.video
        })

        websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['y']})
    }
}