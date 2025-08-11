import BaseChannelPoint from "./BaseChannelPoint";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {getAssetConfig, getConfig} from "../../../../helper/ConfigHelper";
import getWebsocketServer from "../../../../App";
import {sleep} from "../../../../../../helper/GeneralHelper";
import {addAlert, isAlertActive} from "../../../../helper/AlertHelper";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";

export default class ShieldPurgeChannelPoint extends BaseChannelPoint {
    title = 'Shield Purge'

    async handle(event: EventSubChannelRedemptionAddEvent) {
        const theme = getAssetConfig('shield_purge')

        const websocketServer = getWebsocketServer()

        const shipApiData = await (await fetch(shipDiagnosticsConfig.url)).json()

        if(shipApiData.in_taxi || shipApiData.in_multicrew) {
            await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil ich gerade nicht in meinen eigenen Fahrzeug unterwegs bin.", "not_own_vehicle")
            return
        }

        if(shipApiData.ship_docked) {
            await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil das Schiff angedockt ist.", "ship_docked")
            return
        }

        if(shipApiData.ship_landed) {
            await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil das Schiff gelandet ist.", "ship_landed")
            return
        }

        if(shipApiData.fsd_jump) {
            await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil im Hyperraum kein Boost aktuell möglich ist.", "in_hyperspace")
            return
        }

        if(shipApiData.supercruise_overcharge_active) {
            await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil der Supercruise Overcharge aktiv ist.", "overcharge_active")
            return
        }

        if(shipApiData.silent_running) {
            await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil aktuell die Schleichfahrt aktiv ist.", "silent_running")
            return
        }

        if(!shipApiData.shields_up) {
            await this.deny(event, "Deine Kanalpunkte wurden dir zurück gegeben weil keine Schilde aktiv sind.", "no_shields")
            return
        }

        const isActive = addAlert({
            'channel': 'elite_override',
            'sound': theme.sound,
            'duration': 5,
            'color': theme.color,
            'icon': theme.icon,
            'message': `Shield purged`,
            'event-uuid': this.eventUuid,
            'video': theme.video,
            'lamp_color': theme.lamp_color
        })

        if(!isActive) {
            await waitUntil(() => isAlertActive(this.title), {timeout: WAIT_FOREVER})
        }

        if(shipApiData.in_ship || shipApiData.in_srv) {
            websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['insert']})
            await sleep(100)
            websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['insert']})
        } else if(shipApiData.on_foot) {
            websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['c']})
            await sleep(15_000)
            websocketServer.send('trigger_keyboard', {'name': 'ship', 'keys': ['c']})
        }
    }
}