import {logDebug, logRegular, logWarn} from "./LogHelper";
import {readSystemConfig} from "./ConfigHelper";
import getWebsocketServer, {getOBSClient} from "../App";

let currentSourceFilters = {
    sources: {} as Record<string, any>
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

async function getCategorySourceFilters() {
    const {getActiveCategoryEntry, findObsFilterSource} = await import("./CategoryLibraryHelper");
    const entry = getActiveCategoryEntry();
    if (!entry) return null;

    const source = findObsFilterSource(entry);
    if (source && source.entry.category_id !== entry.category_id) {
        logRegular(`category library OBS filters: ${entry.name} has no filters, using fallback ${source.entry.name} (${source.entry.category_id})`);
    }

    return {
        sources: structuredClone(source?.filters ?? {}),
    };
}

async function saveCategorySourceFilters(filters: Record<string, any>) {
    const {setActiveCategoryObsFilters} = await import("./CategoryLibraryHelper");
    return setActiveCategoryObsFilters(filters);
}

export async function updateSourceFilters() {
    try {
        logDebug("update source filters")
        const obsClient = getOBSClient()
        const categorySettings = readSystemConfig().category_library

        if (!categorySettings.enabled) {
            currentSourceFilters = {sources: {}}
            getWebsocketServer().send('notify_source_update', currentSourceFilters)
            return
        }

        const categoryFilters = await getCategorySourceFilters()
        if (!categoryFilters) {
            logWarn("source filter update skipped: category library has no active category")
            currentSourceFilters = {sources: {}}
            getWebsocketServer().send('notify_source_update', currentSourceFilters)
            return
        }
        currentSourceFilters = categoryFilters

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
    logRegular(`add source locally: ${name} [${uuid}] (${obsId})`)

    if (!readSystemConfig().category_library.enabled) {
        return {success: false, error: 'category library is disabled'}
    }

    const {getActiveCategoryEntry, setActiveCategoryObsFilters} = await import("./CategoryLibraryHelper");
    const entry = getActiveCategoryEntry();
    if (!entry) return {success: false, error: 'no active category'};

    const filters = structuredClone(entry.obs_filters ?? {});
    filters[uuid] ??= {name, obs_id: obsId, filters: {}};
    filters[uuid].name = name;
    filters[uuid].obs_id = obsId;
    filters[uuid].filters ??= {};
    await setActiveCategoryObsFilters(filters);

    return {success: true, local: true};
}

export async function saveSourceFilters() {
    logDebug("save source filters")
    const newSourceFilters: Record<string, any> = {}
    const obsClient = getOBSClient()

    if(!obsClient?.connected) return

    const connectionNames = obsClient.getConnectionNames?.() ?? ['default']

    for(const connectionName of connectionNames) {
        await obsClient.fetchItems(connectionName)
    }

    if (!readSystemConfig().category_library.enabled) {
        logWarn("save source filters skipped: category library is disabled")
        return
    }

    const byUuid = new Map<string, any>()

    for (const connectionName of connectionNames) {
        for (const canvas of obsClient.getSceneData(connectionName) ?? []) {
            for (const scene of canvas.scenes ?? []) {
                const collect = (items: any[]) => {
                    for (const item of items ?? []) {
                        const uuid = String(item?.uuid ?? item?.sourceUuid ?? '').trim()
                        if (uuid && !byUuid.has(uuid)) {
                            byUuid.set(uuid, {
                                uuid,
                                name: item?.name ?? item?.sourceName ?? uuid,
                                obs_id: connectionName,
                            })
                        }
                        if (Array.isArray(item?.children) && item.children.length) collect(item.children)
                    }
                }
                collect(scene.items ?? [])
            }
        }
    }

    const sources: any[] = [...byUuid.values()]

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
            name: source.name ?? source.uuid,
            obs_id: obsId,
            filters: {},
        }

        const sourceFilters = (await obsWebsocket.call('GetSourceFilterList', {sourceUuid: source.uuid})).filters

        for(const filter of sourceFilters) {
            newSourceFilters[source.uuid].filters[filter.filterName] = {
                config: filter.filterSettings,
                sourceIndex: filter.filterIndex
            }
        }

        newSourceFilters[source.uuid].filters["Source|Transform"] = {
            config: sourceItemData.transform,
            sourceIndex: 0
        }
    }

    await saveCategorySourceFilters(newSourceFilters)
    currentSourceFilters = {
        sources: structuredClone(newSourceFilters),
    }
    getWebsocketServer().send('notify_source_update', currentSourceFilters)
}

export function getSourceFilters() {
    return currentSourceFilters
}
