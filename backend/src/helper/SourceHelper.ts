import getGameInfo from "./GameHelper";
import {fetchSourceFilters, generateBaseUrl, getSourceFilters, getSources} from "../clients/website/WebsiteClient";
import {logDebug} from "./LogHelper";
import getWebsocketServer, {getOBSClient} from "../App";

let currentSourceFilters = {
    background: null,
    filters: []
}

export async function updateSourceFilters() {
    logDebug("update source filters")
    const gameInfo = getGameInfo()
    currentSourceFilters = (await fetchSourceFilters(gameInfo.data.game_id)).data

    getWebsocketServer().send('notify_source_update', currentSourceFilters)

    console.log(currentSourceFilters)
}

export async function saveSourceFilters() {
    logDebug("save source filters")
    const gameInfo = getGameInfo()
    const sources = (await getSources()).data
    const newSourceFilters = {}

    for (const source of sources) {
        newSourceFilters[source.uuid] = {}
        const sourceFilters = (await getOBSClient().getOBSWebSocket().call('GetSourceFilterList', {sourceUuid: source.uuid})).filters

        for(const filter of sourceFilters) {
            newSourceFilters[source.uuid][filter.filterName] = filter.filterSettings
        }
    }

    const url = generateBaseUrl(`source&game_id=${gameInfo.data.game_id}&mode=updateFilters`)
    logDebug(`request website post api: ${url}`)

    await fetch(url, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(newSourceFilters)
    })
}

export function getSourceFilters() {
    return currentSourceFilters
}