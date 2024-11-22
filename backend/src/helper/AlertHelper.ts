import {removeEventFromQuery} from "../clients/twitch/helper/CooldownHelper";
import getWebsocketServer from "../App";
import {pushTheme, setManual} from "./ThemeHelper";

const alertQuery = {}

export default function initialAlerts() {
    const websocketServer = getWebsocketServer()

    setInterval(() => {
        if(Object.keys(alertQuery).length === 0) return

        for(const key in alertQuery) {
            const activeAlert = alertQuery[key][0]

            if(activeAlert.duration > 0) {
                activeAlert.duration--

                websocketServer.send('show_alert', activeAlert)

                if(activeAlert.active) {
                    alertQuery[0] = activeAlert
                    return
                }

                activeAlert.active = true

                if(activeAlert.color) {
                    setManual(activeAlert.color)
                    pushTheme()
                }

                alertQuery[key][0] = activeAlert
                return
            }

            websocketServer.send('hide_alert', {})

            removeAlert(activeAlert)
        }

        if(Object.keys(alertQuery).length > 0) return

        setManual()
        pushTheme()
    }, 1000)
}

export function addAlert(alert: any) {
    if(alert.video) alert.video = `${alert.video}.mp4`
    if(alert.sound) alert.sound = `${alert.sound}.mp3`
    if(!alert.channel) alert.channel = 'general'

    if(!alertQuery[alert.channel]) alertQuery[alert.channel] = []

    alertQuery[alert.channel].push(alert)
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

        removeEventFromQuery(alert['event-uuid'])
    }
}