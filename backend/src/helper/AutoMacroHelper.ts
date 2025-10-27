import {getConfig} from "./ConfigHelper";
import {logDebug, logRegular, logSuccess, logWarn} from "./LogHelper";
import {triggerMacro} from "./MacroHelper";
import getWebsocketServer from "../App";

let autoMacros = []

export function initAutoMacros() {
    logRegular("init auto macros")
    autoMacros = []

    const config = getConfig(/auto_macro /g, true)

    for(const key in config) {
        const partialConfig = config[key]

        if(!partialConfig.macros) {
            logWarn(`the auto macros ${key} has no macros defined!`)
            continue
        }

        if(partialConfig.interval) {
            partialConfig.interval *= 60
        }

        autoMacros.push({
            name: key,
            enabled: partialConfig.default_enabled ?? false,
            interval: partialConfig.interval ?? 10 * 60,
            current_interval: partialConfig.interval ?? 10 * 60,
            macros: partialConfig.macros
        })

        logRegular(`loaded auto macros ${key}`)
    }

    logSuccess(`loaded ${autoMacros.length} auto macros`)
}

export async function updateAutoMacros() {
    for(const index in autoMacros) {
        const autoMessage = autoMacros[index]

        if(!autoMessage.enabled) continue

        autoMessage.current_interval--

        logDebug(`update auto macro ${autoMessage.name} interval: ${autoMessage.current_interval} / ${autoMessage.interval}`)

        if(autoMessage.current_interval <= 0) {
            autoMessage.current_interval = autoMessage.interval
            logRegular(`trigger auto macro ${autoMessage.name}`)

            for (const macro of autoMessage.macros) {
                await triggerMacro(macro)
            }
        }
    }

    getWebsocketServer().send('notify_auto_macros_update', autoMacros)
}

export function toggleAutoMacro(name: string, enabled: boolean) {
    for(const index in autoMacros) {
        if(autoMacros[index].name !== name) continue

        autoMacros[index].enabled = enabled

        if(!enabled) {
            autoMacros[index].current_interval = autoMacros[index].interval
        }
    }

    getWebsocketServer().send('notify_auto_macros_update', autoMacros)
}

export function getAutoMacros() { return autoMacros }