import {getConfig} from "../../helper/ConfigHelper";
import {logDebug} from "../../helper/LogHelper";

let adData = {}

export async function requestApi(slug: string)
{
    const url = generateBaseUrl(slug);
    return await (await fetch(url)).json()
}

export function generateBaseUrl(slug: string) {
    const config = getConfig(/api website/g)[0]
    logDebug(`request website api: ${config.url}${config.api_slug}&token=REDACTED&method=${slug}`)
    return `${config.url}${config.api_slug}&token=${config.token}&method=${slug}`
}

export async function getGameInfoData() {
    return (await requestApi('getGame')).data
}

export async function getGamesInfoData() {
    return (await requestApi('getGames')).data
}

export async function getAdData(forceUpdate = false) {
    if(Object.keys(adData).length === 0 || forceUpdate) {
        adData = await requestApi('getAd')
    }
    return adData
}

export async function getVariableData(variable: string) {
    return await requestApi(`variable&variable=${variable}`)
}

export async function setVariableData(variable: string, value: string) {
    return await requestApi(`variable&variable=${variable}&set=${value}`)
}

export async function getYoutubeData() {
    return await requestApi(`getData&data=youtube`)
}

export async function getGithubData() {
    return await requestApi(`getData&data=github`)
}

export async function getTwitchData() {
    return await requestApi(`getData&data=twitch`)
}

export async function getDeathCounter() {
    return await requestApi(`death`)
}

export async function editDeathCounter(mode: string, value: number = 0) {
    return await requestApi(`death&edit=${mode}&value=${value}`)
}

export async function updateGameState(state: string) {
    return await requestApi(`updateGame&state=${state}`)
}

export async function updateTwitchData() {
    return await requestApi(`updateTwitch`)
}

export async function editGameTracker(gameId: string, mode: string = 'add') {
    if(!(await getTwitchData()).stream) return
    return await requestApi(`editGameTracker&game_id=${gameId}&mode=${mode}`)
}

export async function getSources() {
    return await requestApi(`source&mode=getSources`)
}

export async function getSourceFilters(gameId: string) {
    return await requestApi(`source&game_id=${gameId}&mode=getFilters`)
}