import getGameInfo from "./GameHelper";
import {fetchSourceFilters, generateBaseUrl, getSources} from "../clients/website/WebsiteClient";
import {logDebug, logWarn} from "./LogHelper";
import getWebsocketServer, {getOBSClient} from "../App";

let currentSourceFilters = {
    background: null,
    sources: []
}

export async function updateSourceFilters() {
    logDebug("update source filters")
    const gameInfo = getGameInfo()
    const obsClient = getOBSClient()

    if(!obsClient.connected) {
        currentSourceFilters = {
            background: null,
            sources: []
        }

        getWebsocketServer().send('notify_source_update', currentSourceFilters)
        return
    }

    currentSourceFilters = (await fetchSourceFilters(gameInfo.data.game_id)).data

    getWebsocketServer().send('notify_source_update', currentSourceFilters)

    for(const sourceUuid in currentSourceFilters.sources) {
        const databaseSource = currentSourceFilters.sources[sourceUuid]
        const sourceItemData = obsClient.getSceneItemByUuid(sourceUuid)

        if(!sourceItemData) continue

        for(const filterName in databaseSource.filters) {
            const filter = databaseSource.filters[filterName];
            const config = JSON.parse(filter.config)

            if(config.boundsType === "OBS_BOUNDS_NONE") {
                delete config["boundsAlignment"]
                delete config["boundsHeight"]
                delete config["boundsWidth"]
                delete config["boundsType"]
            }

            if(filterName.startsWith("Source|")) {
                switch (filterName) {
                    case "Source|Transform":
                        await getOBSClient().getOBSWebSocket().call('SetSceneItemTransform', {
                            sceneUuid: sourceItemData.scene.uuid,
                            sceneItemId: sourceItemData.id,
                            sceneItemTransform: config
                        })
                        break;
                }
                continue
            }
            try {
                delete config["shader_file_name"]
                await getOBSClient().getOBSWebSocket().call('SetSourceFilterIndex', {
                    sourceUuid: sourceUuid,
                    filterName: filterName,
                    filterIndex: filter.index
                })
                await getOBSClient().getOBSWebSocket().call('SetSourceFilterSettings', {
                    sourceUuid: sourceUuid,
                    filterName: filterName,
                    filterSettings: config
                })
            } catch (error) {
                logWarn('obs source filter update failed:')
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
        }
    }
}

export async function saveSourceFilters() {
    logDebug("save source filters")
    const gameInfo = getGameInfo()
    const sources = (await getSources()).data
    const newSourceFilters = {}
    const obsClient = getOBSClient()

    if(!obsClient.connected) return

    await obsClient.fetchItems()

    for (const source of sources) {
        newSourceFilters[source.uuid] = {}
        const sourceFilters = (await getOBSClient().getOBSWebSocket().call('GetSourceFilterList', {sourceUuid: source.uuid})).filters
        const sourceItemData = obsClient.getSceneItemByUuid(source.uuid)

        for(const filter of sourceFilters) {
            newSourceFilters[source.uuid][filter.filterName] = {
                config: filter.filterSettings,
                sourceIndex: filter.filterIndex
            }
        }

        newSourceFilters[source.uuid]["Source|Transform"] = {
            config: sourceItemData.transform,
            sourceIndex: 0
        }
    }

    const url = generateBaseUrl(`source&game_id=${gameInfo.data.game_id}&mode=updateFilters`)
    if(!url) return
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