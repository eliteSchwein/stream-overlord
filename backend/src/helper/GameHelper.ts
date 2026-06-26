import {logRegular} from "./LogHelper";
import getWebsocketServer from "../App";
import {getConfig} from "./ConfigHelper";
import {setLedColor} from "./WledHelper";
import {getGameInfoData} from "../clients/website/WebsiteClient";
import RemoteCacheHelper from "./RemoteCacheHelper";

const gameInfo = {
    data: {
        'theme': {}
    } as any,
    manual: ''
}

const rawGameInfo = {
    data: {
        'theme': {}
    } as any,
    manual: ''
}

let currentGameId = 0

function applyManualAndDefaultColor(info: any) {
    const config = getConfig(/theme/g)[0]
    const clonedGameInfo = structuredClone(info)

    clonedGameInfo.data ??= {}
    clonedGameInfo.data['theme'] ??= {}

    if(clonedGameInfo.manual !== '') {
        clonedGameInfo.data['theme']['color'] = '#'+clonedGameInfo.manual
        clonedGameInfo.data['color'] = '#'+clonedGameInfo.manual
    }

    if(clonedGameInfo.data['theme']['color'] === '') {
        clonedGameInfo.data['theme']['color'] = '#'+config.default_color
        clonedGameInfo.data['color'] = '#'+clonedGameInfo.manual
    }

    if(!clonedGameInfo.data['theme']['color']) {
        clonedGameInfo.data['theme']['color'] = '#'+config.default_color
        clonedGameInfo.data['color'] = '#'+config.default_color
    }

    return clonedGameInfo
}

export default function getGameInfo() {
    return applyManualAndDefaultColor(gameInfo)
}

export function getRawGameInfo() {
    return applyManualAndDefaultColor(rawGameInfo)
}

export function getCurrentGameId() {
    return currentGameId
}

export async function fetchGameInfo() {
    logRegular('fetch theme from website')
    const newGameInfo = await getGameInfoData()

    if(newGameInfo) {
        rawGameInfo.data = structuredClone(newGameInfo)
        gameInfo.data = await RemoteCacheHelper.cacheGameInfo(structuredClone(newGameInfo))
    }

    currentGameId = gameInfo.data?.game_id
}

export function pushGameInfo(websocket?: WebSocket) {
    const gameInfo = getGameInfo()
    getWebsocketServer().send('notify_game_update', gameInfo, websocket)
}

export function setManualColor(value: string|undefined = undefined) {
    if(value) {
        logRegular(`set manual theme color: ${value}`);
        gameInfo.manual = value
        rawGameInfo.manual = value
        return
    }

    logRegular('reset manual theme color');
    gameInfo.manual = ''
    rawGameInfo.manual = ''
    void setLedColor()
}
