import {logRegular} from "./LogHelper";
import getWebsocketServer from "../App";
import {getConfig} from "./ConfigHelper";
import {setLedColor} from "./WledHelper";
import {getGameInfoData} from "../clients/website/WebsiteClient";

const gameInfo = {
    data: {},
    manual: ''
}

let currentGameId = 0

export default function getGameInfo() {
    const config = getConfig(/theme/g)[0]
    const clonedGameInfo = structuredClone(gameInfo)

    if(clonedGameInfo.manual !== '') {
        clonedGameInfo.data['color'] = '#'+clonedGameInfo.manual
    }

    if(clonedGameInfo.data['color'] === '') {
        clonedGameInfo.data['color'] = '#'+config.default_color
    }

    console.log(clonedGameInfo)
    console.log(config)

    return clonedGameInfo
}

export function getCurrentGameId() {
    return currentGameId
}

export async function fetchGameInfo() {
    logRegular('fetch theme from website')
    const newGameInfo = await getGameInfoData()
    if(newGameInfo) {
        gameInfo.data = newGameInfo
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
        return
    }

    logRegular('reset manual theme color');
    gameInfo.manual = ''
    void setLedColor()
}