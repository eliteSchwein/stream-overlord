import {logRegular} from "./LogHelper";
import getWebsocketServer from "../App";
import {getThemeSettings, readSystemConfig} from "./ConfigHelper";
import {setLedColor} from "./WledHelper";
import {getCachedTwitchCategory} from "./TwitchDataHelper";

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
    const themeSettings = getThemeSettings()
    const clonedGameInfo = structuredClone(info)

    clonedGameInfo.data ??= {}
    clonedGameInfo.data['theme'] ??= {}

    if(clonedGameInfo.manual !== '') {
        clonedGameInfo.data['theme']['color'] = '#'+clonedGameInfo.manual
        clonedGameInfo.data['color'] = '#'+clonedGameInfo.manual
    }

    if(clonedGameInfo.data['theme']['color'] === '') {
        clonedGameInfo.data['theme']['color'] = '#'+themeSettings.default_color
        clonedGameInfo.data['color'] = '#'+themeSettings.default_color
    }

    if(!clonedGameInfo.data['theme']['color']) {
        clonedGameInfo.data['theme']['color'] = '#'+themeSettings.default_color
        clonedGameInfo.data['color'] = '#'+themeSettings.default_color
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
    logRegular('fetch theme from category library')

    const twitchCategory = getCachedTwitchCategory()
    const settings = readSystemConfig().category_library
    let entry: any = null

    if (settings.enabled) {
        const {getActiveCategoryEntry} = await import("./CategoryLibraryHelper")
        entry = getActiveCategoryEntry()
    }

    const categoryId = String(entry?.category_id ?? twitchCategory?.id ?? '').trim()
    const categoryName = String(entry?.name ?? twitchCategory?.name ?? '').trim()
    const color = entry?.theme_color ? `#${String(entry.theme_color).replace(/^#/, '')}` : ''

    const localInfo = {
        game_id: categoryId ? Number(categoryId) : 0,
        game_name: categoryName,
        theme: {
            color,
            style: settings.enabled ? String(entry?.custom_css ?? '') : '',
        },
        color,
        media: settings.enabled ? {
            cover: entry?.cover_path ?? null,
        } : {},
    }

    rawGameInfo.data = structuredClone(localInfo)
    gameInfo.data = structuredClone(localInfo)
    currentGameId = Number(localInfo.game_id || 0)
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
