import {removeEventFromQuery} from "../clients/twitch/helper/CooldownHelper";
import getWebsocketServer from "../App";
import {pushGameInfo, setManualColor} from "./GameHelper";
import {setLedColor} from "./WledHelper";

const alertQuery = []
const activeAlerts = []

export default function initialAlerts() {
    const websocketServer = getWebsocketServer()

    setInterval(() => {
        websocketServer.send('notify_alert_query', alertQuery)

        if(alertQuery.length === 0) return

        const activeAlert = alertQuery[0]

        if(activeAlert.duration > 0) {
            activeAlert.duration--

            websocketServer.send('notify_alert', {...activeAlert, action: 'show'})

            if(activeAlert.active) {
                if(!activeAlerts.includes(activeAlert['event-uuid'])) activeAlerts.push(activeAlert['event-uuid'])

                alertQuery[0] = activeAlert
                return
            }

            activeAlert.active = true

            if(activeAlert.color) {
                setManualColor(activeAlert.color)
                pushGameInfo()
            }

            if(activeAlert.lamp_color) {
                void setLedColor(activeAlert.lamp_color)
            }

            alertQuery[0] = activeAlert
            return
        }

        websocketServer.send('notify_alert', {
            channel: activeAlert.channel,
            action: 'hide'
        })

        removeAlert(activeAlert)

        if(alertQuery.length > 0) return

        setManualColor()
        pushGameInfo()
    }, 1000)
}

export function isAlertActive(eventUuid: string|undefined = undefined) {
    if(!eventUuid) {
        return activeAlerts.length > 0
    }
    return activeAlerts.indexOf(eventUuid) > -1
}

export function addAlert(alert: any) {
    if(alert.video) alert.video = `${alert.video}.mp4`
    if(alert.sound) alert.sound = `${alert.sound}.mp3`
    if(!alert.channel) alert.channel = 'general'

    let active = false

    if(alertQuery.length === 0) {
        const websocketServer = getWebsocketServer()

        websocketServer.send('notify_alert', {...alert, action: 'show'})
        active = true
    }

    alertQuery.push(alert)

    return active
}

export function removeAlert(alert: any) {
    for(const alertIndex in alertQuery) {
        const alertPartial = alertQuery[alertIndex]

        if(alert['event-uuid'] !== alertPartial['event-uuid']) continue

        alertQuery.splice(Number(alertIndex), 1)

        activeAlerts.splice(activeAlerts.indexOf(alert['event-uuid']), 1)

        removeEventFromQuery(alert['event-uuid'])
    }
}