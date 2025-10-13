import {getConfig, getPrimaryChannel} from "./ConfigHelper";
import {triggerMacro} from "./MacroHelper";
import getWebsocketServer, {getTwitchClient} from "../App";
import {pushGameInfo, setManualColor} from "./GameHelper";
import {logWarn} from "./LogHelper";

let shieldActive = false;

export default function isShieldActive() {
    return shieldActive;
}

export async function enableShield() {
    if(shieldActive) return;
    const config = getConfig(/macro shield_on/g)[0]
    const websocketServer = getWebsocketServer()
    const twitchClient = getTwitchClient()

    logWarn("Shield Mode is active!")

    shieldActive = true

    const primaryChannel = getPrimaryChannel()

    await twitchClient.getBot().api.moderation.updateShieldModeStatus(
        primaryChannel,
        true
    )

    setManualColor('FF1744')
    pushGameInfo()

    websocketServer.send('notify_shield_mode', {action: 'enable'})

    if(config) {
        await triggerMacro('shield_on')
    }
}

export async function disableShield() {
    if(!shieldActive) return;
    const config = getConfig(/macro shield_off/g)[0]
    const websocketServer = getWebsocketServer()
    const twitchClient = getTwitchClient()

    logWarn("Shield Mode is inactive!")

    shieldActive = false

    const primaryChannel = getPrimaryChannel()

    await twitchClient.getBot().api.moderation.updateShieldModeStatus(
        primaryChannel,
        false
    )

    setManualColor()
    pushGameInfo()

    websocketServer.send('notify_shield_mode', {action: 'disable'})

    if(config) {
        await triggerMacro('shield_off')
    }
}