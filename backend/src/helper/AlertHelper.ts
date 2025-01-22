import {removeEventFromQuery} from "../clients/twitch/helper/CooldownHelper";
import getWebsocketServer from "../App";
import {pushGameInfo, setManualColor} from "./GameHelper";
import {setLedColor} from "./WledHelper";

const alertQuery = {}
const activeAlerts = []

export default function initialAlerts() {
    const websocketServer = getWebsocketServer()

    setInterval(() => {
        if(Object.keys(alertQuery).length === 0) return

        for(const key in alertQuery) {
            const activeAlert = alertQuery[key][0]
            if(!activeAlert) continue

            if(activeAlert.duration > 0) {
                activeAlert.duration--

                websocketServer.send('notify_alert', {...activeAlert, action: 'show'})

                if(activeAlert.active) {
                    if(!activeAlerts.includes(activeAlert['event-uuid'])) activeAlerts.push(activeAlert['event-uuid'])

                    alertQuery[key][0] = activeAlert
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

                alertQuery[key][0] = activeAlert
                return
            }

            websocketServer.send('notify_alert', {
                channel: key,
                action: 'hide'
            })

            removeAlert(activeAlert)
        }

        if(Object.keys(alertQuery).length > 0) return

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

    if(!alertQuery[alert.channel]) {
        const websocketServer = getWebsocketServer()

        alertQuery[alert.channel] = []
        websocketServer.send('notify_alert', {...alert, action: 'show'})
        active = true
    }

    alertQuery[alert.channel].push(alert)

    return active
}

export function removeAlert(alert: any) {
    if(!alert.channel) alert.channel = 'general'

    for(const alertIndex in alertQuery[alert.channel]) {
        const alertPartial = alertQuery[alert.channel][alertIndex]

        if(alert['event-uuid'] !== alertPartial['event-uuid']) continue

        alertQuery[alert.channel].splice(Number(alertIndex), 1)

        if(alertQuery[alert.channel].length === 0) {
            delete alertQuery[alert.channel]
        }

        activeAlerts.splice(activeAlerts.indexOf(alert['event-uuid']), 1)

        removeEventFromQuery(alert['event-uuid'])
    }
}