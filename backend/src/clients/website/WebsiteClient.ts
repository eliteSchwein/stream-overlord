import {getConfig} from "../../helper/ConfigHelper";

async function requestApi(slug: string) {
    const config = getConfig(/api website/g)[0]

    return await (await fetch(`${config.url}${config.api_slug}&token=${config.token}&method=${slug}`)).json()
}

export default async function getThemeData() {
    return  await requestApi('getTheme')
}

export async function getAdData() {
    return await requestApi('getAd')
}

export async function getVariableData(variable: string) {
    return await requestApi(`variable&variable=${variable}`)
}

export async function setVariableData(variable: string, value: string) {
    return await requestApi(`variable&variable=${variable}&set=${value}`)
}

export async function getYoutubeData() {
    return await requestApi(`getData&data=youtube}`)
}

export async function getGithubData() {
    return await requestApi(`getData&data=github}`)
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