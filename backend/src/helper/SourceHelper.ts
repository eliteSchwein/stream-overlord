import getGameInfo from "./GameHelper";
import {fetchSourceFilters, generateBaseUrl, getSources} from "../clients/website/WebsiteClient";
import {logDebug, logRegular, logWarn} from "./LogHelper";
import RemoteCacheHelper from "./RemoteCacheHelper";
import getWebsocketServer, {getOBSClient} from "../App";

let currentSourceFilters = {
    background: null,
    backgrounds: [],
    sources: []
}

function getSourceObsId(source: any): string {
    return String(source?.obs_id ?? source?.obsId ?? source?.obs ?? 'default')
}

function parseFilterConfig(config: any) {
    if(typeof config === 'string') {
        return JSON.parse(config)
    }

    return config ?? {}
}

export async function updateSourceFilters() {
    try {
        logDebug("update source filters")
        const gameInfo = getGameInfo()
        const obsClient = getOBSClient()

        const response = await fetchSourceFilters(gameInfo.data?.game_id)

        if (!response?.data) {
            logWarn("source filter update skipped: website returned no data")
            currentSourceFilters = {
                background: null,
                backgrounds: [],
                sources: []
            }

            getWebsocketServer().send('notify_source_update', currentSourceFilters)
            return
        }

        currentSourceFilters = await RemoteCacheHelper.cacheSourceUpdate(response.data)

        getWebsocketServer().send('notify_source_update', currentSourceFilters)

        if(!obsClient || !obsClient.connected) {
            return
        }

        for(const sourceUuid in currentSourceFilters.sources) {
            const databaseSource = currentSourceFilters.sources[sourceUuid]
            const obsId = getSourceObsId(databaseSource)
            const sourceItemData = obsClient.getSceneItemByUuid(sourceUuid, obsId)
            const obsWebsocket = obsClient.getOBSWebSocket(obsId)

            if(!sourceItemData || !obsWebsocket) continue

            for(const filterName in databaseSource.filters ?? {}) {
                try {
                    const filter = databaseSource.filters[filterName]
                    const config = parseFilterConfig(filter.config)

                    if(config.boundsType === "OBS_BOUNDS_NONE") {
                        delete config["boundsAlignment"]
                        delete config["boundsHeight"]
                        delete config["boundsWidth"]
                        delete config["boundsType"]
                    }

                    if(filterName.startsWith("Source|")) {
                        switch (filterName) {
                            case "Source|Transform":
                                await obsWebsocket.call('SetSceneItemTransform', {
                                    sceneUuid: sourceItemData.scene.uuid,
                                    sceneItemId: sourceItemData.id,
                                    sceneItemTransform: config
                                })
                                break
                        }
                        continue
                    }

                    delete config["shader_file_name"]

                    await obsWebsocket.call('SetSourceFilterIndex', {
                        sourceUuid,
                        filterName,
                        filterIndex: filter.index ?? filter.sourceIndex ?? 0
                    })

                    await obsWebsocket.call('SetSourceFilterSettings', {
                        sourceUuid,
                        filterName,
                        filterSettings: config
                    })
                } catch (error) {
                    logWarn(`obs source filter update failed (${obsId}):`)
                    logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
                }
            }
        }
    } catch (error) {
        logWarn("source filter update failed:")
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
}

export async function addSource(name: string, uuid: string, obsId = 'default') {
    logRegular(`add source: ${name} [${uuid}] (${obsId})`)

    const gameInfo = getGameInfo()
    const url = generateBaseUrl(`source&game_id=${gameInfo.data?.game_id}&mode=addSource`)

    if(!url) return

    logDebug(`request website post api: ${url}`)

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name,
            uuid,
            obs_id: obsId,
        })
    })

    try {
        return await response.json()
    } catch (error) {
        return undefined
    }
}

export async function saveSourceFilters() {
    logDebug("save source filters")
    const gameInfo = getGameInfo()
    const sources = (await getSources()).data
    const newSourceFilters = {}
    const obsClient = getOBSClient()

    if(!obsClient?.connected) return

    const connectionNames = obsClient.getConnectionNames?.() ?? ['default']

    for(const connectionName of connectionNames) {
        await obsClient.fetchItems(connectionName)
    }

    for (const source of sources) {
        const preferredObsId = source?.obs_id ? String(source.obs_id) : undefined
        const obsId = preferredObsId && obsClient.getSceneItemByUuid(source.uuid, preferredObsId)
            ? preferredObsId
            : connectionNames.find((connectionName: string) => obsClient.getSceneItemByUuid(source.uuid, connectionName))

        if(!obsId) continue

        const obsWebsocket = obsClient.getOBSWebSocket(obsId)
        const sourceItemData = obsClient.getSceneItemByUuid(source.uuid, obsId)

        if(!obsWebsocket || !sourceItemData) continue

        newSourceFilters[source.uuid] = {
            obs_id: obsId,
        }

        const sourceFilters = (await obsWebsocket.call('GetSourceFilterList', {sourceUuid: source.uuid})).filters

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

    const url = generateBaseUrl(`source&game_id=${gameInfo.data?.game_id}&mode=updateFilters`)
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
