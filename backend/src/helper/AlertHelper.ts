import {removeEventFromQuery} from "../clients/twitch/helper/CooldownHelper";
import getWebsocketServer from "../App";
import {pushTheme, setManual} from "./ThemeHelper";

const alertQuery = []

export default function initialAlerts() {
    const websocketServer = getWebsocketServer()

    setInterval(() => {
        if(alertQuery.length === 0) return

        const activeAlert = alertQuery[0]

        if(activeAlert.duration > 0) {
            activeAlert.duration--

            websocketServer.send('show_alert', activeAlert)

            if(activeAlert.active) {
                alertQuery[0] = activeAlert
                return
            }

            activeAlert.active = true

            setManual(activeAlert.color)
            pushTheme()

            alertQuery[0] = activeAlert
            return
        }

        websocketServer.send('hide_alert', {})

        removeAlert(activeAlert)

        if(alertQuery.length > 0) return

        setManual()
        pushTheme()
    }, 1000)
}

export function addAlert(alert: any) {
    if(alert.video) alert.video = `${alert.video}.mp4`
    if(alert.sound) alert.sound = `${alert.sound}.mp3`

    alertQuery.push(alert)
}

export function removeAlert(alert: any) {
    for(const alertIndex in alertQuery) {
        const alertPartial = alertQuery[alertIndex]

        if(alert['event-uuid'] !== alertPartial['event-uuid']) continue

        alertQuery.splice(Number(alertIndex), 1)

        removeEventFromQuery(alert['event-uuid'])
    }
}