import { useAppStore } from '@/stores/app'

export const OBS_BOOLEAN_ITEMS = [
  { title: 'Yes', value: true },
  { title: 'No', value: false },
]

export function asArray(value: any): any[] {
  return Array.isArray(value) ? value : []
}

export function uniqSorted(values: any[]): string[] {
  return [...new Set(values.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b))
}

export function getSceneName(scene: any): string {
  return String(scene?.sceneName ?? scene?.name ?? scene?.scene_name ?? '')
}

export function getSceneUuid(scene: any): string {
  return String(scene?.sceneUuid ?? scene?.sceneUUID ?? scene?.uuid ?? scene?.id ?? scene?.sceneId ?? scene?.scene_id ?? '')
}

export function getSceneItems(scene: any): any[] {
  return asArray(scene?.sceneItems ?? scene?.items ?? scene?.sources ?? scene?.scene_items)
}

export function getSourceName(item: any): string {
  return String(item?.sourceName ?? item?.name ?? item?.inputName ?? item?.source_name ?? '')
}

export function getSceneItemId(item: any): any {
  return item?.sceneItemId ?? item?.id ?? item?.scene_item_id ?? null
}

export function getSceneOptions(obsSceneData: any): any[] {
  return asArray(obsSceneData)
    .map((scene: any) => {
      const title = getSceneName(scene)
      const uuid = getSceneUuid(scene)

      if (!title || !uuid) return null

      return {
        title,
        value: uuid,
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.title.localeCompare(b.title))
}

export function getSceneNames(obsSceneData: any): string[] {
  return uniqSorted(asArray(obsSceneData).map(getSceneName))
}

export function getSceneUuids(obsSceneData: any): string[] {
  return uniqSorted(asArray(obsSceneData).map(getSceneUuid))
}

export function findSceneUuidByName(obsSceneData: any, sceneName: string): string {
  if (!sceneName) return ''

  const scene = asArray(obsSceneData).find((entry: any) => getSceneName(entry) === sceneName)
  return scene ? getSceneUuid(scene) : ''
}

export function getSceneItemOptions(obsSceneData: any, sceneUuid: string): any[] {
  const scene = asArray(obsSceneData).find((entry: any) => getSceneUuid(entry) === sceneUuid)

  return getSceneItems(scene)
    .map((item: any) => {
      const name = getSourceName(item)
      const id = getSceneItemId(item)

      if (!name || id === null || id === undefined) return null

      return {
        title: `${name} (#${id})`,
        value: id,
      }
    })
    .filter(Boolean)
}

export function collectInputNamesFromObsAudioData(obsAudioData: any): string[] {
  const names: string[] = []

  const walk = (value: any) => {
    if (!value) return

    if (Array.isArray(value)) {
      value.forEach(walk)
      return
    }

    if (typeof value !== 'object') return

    const name = value.inputName ?? value.sourceName ?? value.name ?? value.label
    if (name) names.push(String(name))

    Object.values(value).forEach(walk)
  }

  walk(obsAudioData)
  return names
}

export function getInputNames(obsSceneData: any, obsAudioData: any = null): string[] {
  const names: string[] = []

  for (const scene of asArray(obsSceneData)) {
    for (const item of getSceneItems(scene)) {
      const name = getSourceName(item)
      if (name) names.push(name)
    }
  }

  names.push(...collectInputNamesFromObsAudioData(obsAudioData))

  return uniqSorted(names)
}

export function getFilterNames(obsSceneData: any, sourceName: string): string[] {
  const filters: string[] = []

  const collect = (item: any) => {
    if (!item || typeof item !== 'object') return

    const itemName = getSourceName(item)
    if (sourceName && itemName && itemName !== sourceName) return

    const candidates = [
      item.filters,
      item.sourceFilters,
      item.source_filters,
      item.filterList,
      item.filter_list,
    ]

    for (const list of candidates) {
      for (const filter of asArray(list)) {
        const name = filter?.filterName ?? filter?.name ?? filter?.sourceName
        if (name) filters.push(String(name))
      }
    }
  }

  for (const scene of asArray(obsSceneData)) {
    collect(scene)
    getSceneItems(scene).forEach(collect)
  }

  return uniqSorted(filters)
}

export function ensureTaskData(item: any): any {
  if (!item.task || typeof item.task !== 'object') item.task = {}
  if (!item.task.data || typeof item.task.data !== 'object' || Array.isArray(item.task.data)) item.task.data = {}
  return item.task.data
}

export function ensureObsTask(item: any, method: string, defaults: Record<string, any> = {}) {
  if (!item.task || typeof item.task !== 'object') item.task = {}

  item.task.channel = 'obs'
  item.task.method = method

  const data = ensureTaskData(item)

  for (const [key, value] of Object.entries(defaults)) {
    if (data[key] === undefined) data[key] = value
  }

  return data
}

export function migrateSceneNameToSceneUuid(data: any, obsSceneData: any): void {
  if (!data || typeof data !== 'object') return

  if (!data.sceneUuid && data.sceneName) {
    data.sceneUuid = findSceneUuidByName(obsSceneData, String(data.sceneName))
  }

  if ('sceneName' in data) {
    delete data.sceneName
  }
}

export function obsStoreMixin() {
  return {
    computed: {
      appStore(): any {
        return useAppStore()
      },

      obsData(): any {
        return ensureTaskData((this as any).item)
      },

      obsSceneData(): any[] {
        const store = (this as any).appStore
        return asArray(store?.getObsSceneData ?? store?.obsSceneData)
      },

      obsAudioData(): any {
        const store = (this as any).appStore
        return store?.getObsAudioData ?? store?.obsAudioData ?? {}
      },

      sceneOptions(): any[] {
        return getSceneOptions((this as any).obsSceneData)
      },

      sceneNames(): string[] {
        return getSceneNames((this as any).obsSceneData)
      },

      sceneUuids(): string[] {
        return getSceneUuids((this as any).obsSceneData)
      },

      inputNames(): string[] {
        return getInputNames((this as any).obsSceneData, (this as any).obsAudioData)
      },
    },

    methods: {
      sceneItemOptions(sceneUuid: string): any[] {
        return getSceneItemOptions((this as any).obsSceneData, sceneUuid)
      },

      filterNames(sourceName: string): string[] {
        return getFilterNames((this as any).obsSceneData, sourceName)
      },
    },
  }
}
