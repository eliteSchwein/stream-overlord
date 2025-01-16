import getGameInfoData from "../clients/website/WebsiteClient";
import {logRegular} from "./LogHelper";
import getWebsocketServer from "../App";
import {getConfig} from "./ConfigHelper";
import {Websocket} from "websocket-ts";
import {setLedColor} from "./WledHelper";

const gameInfo = {
    data: {},
    manual: ''
}

export default function getGameInfo() {
    const config = getConfig(/theme/g)[0]
    const clonedGameInfo = structuredClone(gameInfo)

    if(clonedGameInfo.manual !== '') {
        clonedGameInfo.data['color'] = '#'+clonedGameInfo.manual
    }

    if(clonedGameInfo.data['color'] === '') {
        clonedGameInfo.data['color'] = '#'+config.default_color
    }

    return clonedGameInfo
}

export async function fetchGameInfo() {
    logRegular('fetch theme from website')
    theme.data = await getGameInfoData()
}

export function pushGameInfo(websocket: Websocket|undefined = undefined) {
    const theme = getGameInfo()
    if(websocket) {
        websocket.send(JSON.stringify({method: 'game_update', data: theme}))
        return
    }
    getWebsocketServer().send('game_update', theme)
}

export function setManualColor(value: string|undefined = undefined) {
    if(value) {
        logRegular(`set manual theme color: ${value}`);
        theme.manual = value
        return
    }

    logRegular('reset manual theme color');
    theme.manual = ''
    void setLedColor()
}