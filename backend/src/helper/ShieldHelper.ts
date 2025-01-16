import {getConfig} from "./ConfigHelper";
import {triggerScene} from "./SceneHelper";
import getWebsocketServer, {getTwitchClient} from "../App";
import {pushGameInfo, setManualColor} from "./GameHelper";
import {logWarn} from "./LogHelper";

let shieldActive = false;

export default function isShieldActive() {
    return shieldActive;
}

export async function enableShield() {
    if(shieldActive) return;
    const config = getConfig(/scene shield_on/g)[0]
    const websocketServer = getWebsocketServer()
    const twitchClient = getTwitchClient()

    logWarn("Shield Mode is active!")

    shieldActive = true

    const primaryChannel = await twitchClient.getBot().api.users.getUserByName(
        getConfig(/twitch/g)[0]['channels'][0])

    await twitchClient.getBot().api.moderation.updateShieldModeStatus(
        primaryChannel,
        true
    )

    setManualColor('FF1744')
    pushGameInfo()

    websocketServer.send('shield_mode', {status: true})

    if(config) {
        await triggerScene('shield_on')
    }
}

export async function disableShield() {
    if(!shieldActive) return;
    const config = getConfig(/scene shield_off/g)[0]
    const websocketServer = getWebsocketServer()
    const twitchClient = getTwitchClient()

    logWarn("Shield Mode is inactive!")

    shieldActive = false

    const primaryChannel = await twitchClient.getBot().api.users.getUserByName(
        getConfig(/twitch/g)[0]['channels'][0])

    await twitchClient.getBot().api.moderation.updateShieldModeStatus(
        primaryChannel,
        false
    )

    setManualColor()
    pushGameInfo()

    websocketServer.send('shield_mode', {status: false})

    if(config) {
        await triggerScene('shield_off')
    }
}