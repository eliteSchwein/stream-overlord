import {removeEventFromQuery} from "../clients/twitch/helper/CooldownHelper";
import getWebsocketServer from "../App";
import {pushGameInfo, setManualColor} from "./GameHelper";
import {setLedColor} from "./WledHelper";
import {speak} from "./TTShelper";
import {logRegular, logWarn} from "./LogHelper";
import {sleep} from "../../../helper/GeneralHelper";

const alertQuery: any[] = []
const activeAlerts: string[] = []
let activeSound: string|null = null
let alertLoopRunning = false

export default function initialAlerts() {
    const websocketServer = getWebsocketServer()

    setInterval(async () => {
        if (alertLoopRunning) return

        alertLoopRunning = true

        try {
            websocketServer.send('notify_alert_query', alertQuery)

            if(alertQuery.length === 0) return

            const activeAlert = alertQuery[0]

            if(activeAlert.duration > 0) {
                activeAlert.duration--

                websocketServer.send('notify_alert', {...activeAlert, action: 'show'})

                if(activeAlert.active) {
                    if(!activeAlerts.includes(activeAlert['event-uuid'])) {
                        activeAlerts.push(activeAlert['event-uuid'])
                    }

                    alertQuery[0] = activeAlert
                    return
                }

                activeAlert.active = true
                activeAlert.idleRunId = (activeAlert.idleRunId ?? 0) + 1

                if(!activeAlerts.includes(activeAlert['event-uuid'])) {
                    activeAlerts.push(activeAlert['event-uuid'])
                }

                if(activeAlert.color) {
                    setManualColor(activeAlert.color)
                    pushGameInfo()
                }

                if(activeAlert.lamp_color) {
                    void setLedColor(activeAlert.lamp_color)
                }

                void startAlertLifecycle(activeAlert)

                if(activeAlert.speak) {
                    activeAlert['speakFinished'] = false
                    await speak(activeAlert.message)
                    activeAlert['speakFinished'] = true
                }

                alertQuery[0] = activeAlert
                return
            }

            websocketServer.send('notify_alert', {...activeAlert, action: 'hide'})

            if(activeAlert.ending) return

            activeAlert.ending = true
            activeAlert.idleRunId = (activeAlert.idleRunId ?? 0) + 1

            void finishAlertLifecycle(activeAlert)
        } finally {
            alertLoopRunning = false
        }
    }, 1000)
}

async function startAlertLifecycle(alert: any) {
    alert.variables = buildAlertVariables(alert)

    await runAlertMacros(alert.start_macros ?? alert.startMacros, alert.variables, 'start')

    if (!alert.active || alert.ending) return

    void runIdleMacros(alert)
}

async function runIdleMacros(alert: any) {
    const runId = alert.idleRunId
    const macros = alert.idle_macros ?? alert.idleMacros

    if (!getMacroList(macros).length) return

    while (alert.active && !alert.ending && runId === alert.idleRunId) {
        await runAlertMacros(macros, alert.variables, 'idle')
    }
}

async function finishAlertLifecycle(alert: any) {
    alert.active = false

    await runAlertMacros(alert.end_macros ?? alert.endMacros, alert.variables ?? buildAlertVariables(alert), 'end')

    while (alert.speak && !alert.speakFinished) {
        await sleep(100)
    }

    removeAlert(alert)

    if(alertQuery.length > 0) return

    setManualColor()
    pushGameInfo()
}

async function runAlertMacros(macros: any, variables: any = {}, phase: string = '') {
    const macroList = getMacroList(macros)

    if (!macroList.length) return

    const {triggerMacro} = await import('./MacroHelper')

    for (const macro of macroList) {
        if (!macro) continue

        logRegular(`trigger alert ${phase} macro: ${macro}`)
        await triggerMacro(String(macro), variables)
    }
}

function getMacroList(macros: any): string[] {
    if (!macros) return []

    if (Array.isArray(macros)) {
        return macros.map(String).filter(Boolean)
    }

    if (typeof macros === 'string') {
        const trimmed = macros.trim()

        if (!trimmed) return []

        try {
            const parsed = JSON.parse(trimmed)
            return getMacroList(parsed)
        } catch (_) {
            return [trimmed]
        }
    }

    logWarn(`invalid alert macro config: ${JSON.stringify(macros)}`)
    return []
}

function buildAlertVariables(alert: any) {
    return {
        ...(alert.variables ?? {}),
        alert,
        eventUuid: alert['event-uuid'],
        message: alert.message,
        asset: alert.asset,
        channel: alert.channel,
    }
}

export function isAlertActive(eventUuid: string|undefined = undefined) {
    if(!eventUuid) {
        return activeAlerts.length > 0
    }
    return activeAlerts.indexOf(eventUuid) > -1
}

export function addAlert(alert: any) {
    if(alert.video) alert.video = `${alert.video}.webm`
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

        alertPartial.active = false
        alertPartial.ending = true
        alertPartial.idleRunId = (alertPartial.idleRunId ?? 0) + 1

        alertQuery.splice(Number(alertIndex), 1)

        const activeAlertIndex = activeAlerts.indexOf(alert['event-uuid'])
        if(activeAlertIndex > -1) {
            activeAlerts.splice(activeAlertIndex, 1)
        }

        removeEventFromQuery(alert['event-uuid'])
    }
}

export function getActiveSound() {
    return activeSound
}

export function setActiveSound(sound: string|null) {
    activeSound = sound
}
