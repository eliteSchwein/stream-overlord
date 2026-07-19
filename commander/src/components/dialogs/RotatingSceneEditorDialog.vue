<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4" class="rotating-scene-editor-dialog">
      <v-toolbar flat density="comfortable">
        <v-toolbar-title class="d-flex align-center min-width-0">
          <v-icon icon="mdi-sync" class="mr-2" />
          <span class="text-truncate">{{ title }}</span>
        </v-toolbar-title>

        <v-switch
          v-model="rawMode"
          color="primary"
          density="comfortable"
          hide-details
          inset
          :label="$t('dialogs.rotatingSceneEditorDialog.code')"
          class="mr-3"
          @update:model-value="toggleRawMode"
        />

        <YamlImportExportButtons
          class="mr-2"
          :filename="`${visualRotatingScene.name || name || 'rotating_scene'}.yaml`"
          :export-content="rawMode ? content : ''"
          :export-data="rawMode ? null : exportRotatingSceneData()"
          :disabled="loadingFile || saving"
          @import="importRotatingSceneYaml"
          @error="errorMessage = $event?.message ?? 'import failed'"
        />

        <v-btn icon="mdi-refresh" variant="text" :loading="loadingFile" @click="loadRotatingScene" />

        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-content-save"
          :loading="saving"
          :disabled="!visualRotatingScene.name || loadingFile || hasVisualErrors"
          @click="saveRotatingScene"
        >
          Save
        </v-btn>

        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-divider />

      <v-card-text class="pa-3">
        <v-alert
          v-if="errorMessage"
          type="error"
          color="red-darken-3"
          density="comfortable"
          class="mb-3"
          :text="errorMessage"
        />

        <div v-if="rawMode" class="rotating-scene-editor-dialog__code">
          <vue-monaco-editor
            v-model:value="content"
            language="yaml"
            theme="vs-dark"
            height="520px"
            :options="editorOptions"
          />
        </div>

        <div v-else>
          <v-row density="comfortable">
            <v-col cols="12" md="6">
              <v-text-field
                v-model="visualRotatingScene.name"
                :label="$t('dialogs.rotatingSceneEditorDialog.name')"
                density="comfortable"
                variant="outlined"
                hide-details
              />
            </v-col>

            <v-col cols="12" sm="6" md="3">
              <v-text-field
                v-model.number="visualRotatingScene.interval"
                :label="$t('dialogs.rotatingSceneEditorDialog.interval')"
                type="number"
                min="1"
                density="comfortable"
                variant="outlined"
                hide-details
              />
            </v-col>

            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="intervalUnit"
                :items="intervalUnits"
                item-title="title"
                item-value="value"
                :label="$t('dialogs.rotatingSceneEditorDialog.unit')"
                density="comfortable"
                variant="outlined"
                hide-details
              />
            </v-col>

            <v-col cols="12">
              <v-card color="grey-darken-3" variant="flat" class="pa-3">
                <div class="d-flex align-center justify-space-between ga-2 mb-3">
                  <div class="d-flex align-center ga-2 min-width-0">
                    <v-icon icon="mdi-format-list-numbered" />
                    <div class="min-width-0">
                      <div class="text-subtitle-2">{{ $t('dialogs.rotatingSceneEditorDialog.sceneOrder') }}</div>
                      <div class="text-caption text-medium-emphasis">
                        OBS scenes are switched from top to bottom. The saved value is sceneUuid.
                      </div>
                    </div>
                  </div>

                  <v-chip size="small" variant="tonal" class="flex-shrink-0">
                    {{ visualRotatingScene.scenes.length }}
                  </v-chip>
                </div>

                <div class="d-flex ga-2 mb-3 rotating-scene-editor-dialog__scene-add">
                  <v-autocomplete
                    v-model="selectedSceneUuidToAdd"
                    :items="sceneOptions"
                    item-title="title"
                    item-value="value"
                    :label="$t('dialogs.rotatingSceneEditorDialog.addOBSScene')"
                    prepend-inner-icon="mdi-view-dashboard"
                    class="flex-grow-1"
                    density="comfortable"
                    variant="outlined"
                    hide-details="auto"
                    clearable
                    auto-select-first
                    @update:model-value="addSelectedScene"
                  />
                </div>

                <v-alert
                  v-if="!visualRotatingScene.scenes.length"
                  type="info"
                  variant="tonal"
                  density="comfortable"
                  :text="$t('dialogs.rotatingSceneEditorDialog.noScenesSelectedYetAddAtLeastOneOBSScene')"
                />

                <v-list v-else bg-color="transparent" density="compact" class="pa-0">
                  <v-list-item
                    v-for="(scene, index) in visualRotatingScene.scenes"
                    :key="`${scene.sceneUuid}-${index}`"
                    class="rotating-scene-editor-dialog__scene-item mb-2"
                    rounded="lg"
                  >
                    <template #prepend>
                      <v-avatar size="28" color="grey-darken-2" class="mr-3">
                        <span class="text-caption">{{ index + 1 }}</span>
                      </v-avatar>
                    </template>

                    <v-list-item-title class="text-body-2 text-truncate">
                      {{ getSceneLabel(scene) }}
                    </v-list-item-title>

                    <v-list-item-subtitle class="text-caption text-truncate">
                      {{ scene.sceneUuid }}
                    </v-list-item-subtitle>

                    <template #append>
                      <div class="d-flex align-center ga-1">
                        <v-btn
                          size="small"
                          variant="tonal"
                          prepend-icon="mdi-arrow-up"
                          :disabled="index === 0"
                          @click="moveSceneUp(index)"
                        >
                          Move up
                        </v-btn>

                        <v-btn
                          size="small"
                          variant="tonal"
                          prepend-icon="mdi-arrow-down"
                          :disabled="index === visualRotatingScene.scenes.length - 1"
                          @click="moveSceneDown(index)"
                        >
                          Move down
                        </v-btn>

                        <v-btn
                          size="small"
                          color="error"
                          variant="tonal"
                          prepend-icon="mdi-delete"
                          @click="removeScene(index)"
                        >
                          Remove
                        </v-btn>
                      </div>
                    </template>
                  </v-list-item>
                </v-list>
              </v-card>
            </v-col>
          </v-row>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import YamlImportExportButtons from '@/components/YamlImportExportButtons.vue'

type VisualRotatingSceneItem = {
  sceneUuid: string
  sceneName?: string
  canvasUuid?: string
  canvasName?: string
}

type VisualRotatingScene = {
  name: string
  interval: number
  scenes: VisualRotatingSceneItem[]
}

export default {
  name: 'RotatingSceneEditorDialog',

  components: {
    VueMonacoEditor,
    YamlImportExportButtons,
  },

  props: {
    modelValue: { type: Boolean, default: false },
    name: { type: String, default: '' },
    rotatingScene: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    filePath: { type: String, default: '' },
  },

  emits: ['update:modelValue', 'saved'],

  data() {
    return {
      content: '',
      rawMode: false,
      intervalUnit: 'minutes',
      intervalUnits: [
        { title: 'Seconds', value: 'seconds' },
        { title: 'Minutes', value: 'minutes' },
        { title: 'Hours', value: 'hours' },
      ],
      visualRotatingScene: {
        name: '',
        interval: 1,
        scenes: [] as VisualRotatingSceneItem[],
      } as VisualRotatingScene,
      selectedSceneUuidToAdd: '',
      loadingFile: false,
      saving: false,
      errorMessage: '',
      hasVisualErrors: false,
      editorOptions: {
        automaticLayout: true,
        minimap: { enabled: false },
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
      },
    }
  },

  computed: {
    appStore(): any {
      return useAppStore() as any
    },

    title(): string {
      return this.name ? `Edit ${this.name}` : 'Create rotating scene'
    },

    intervalMinutes(): number {
      const interval = Number(this.visualRotatingScene.interval || 1)
      if (this.intervalUnit === 'hours') return interval * 60
      if (this.intervalUnit === 'seconds') return interval / 60
      return interval
    },

    obsSceneData(): any {
      return this.appStore?.getObsSceneData ?? []
    },

    sceneOptions(): any[] {
      return this.getSceneOptions(this.obsSceneData)
    },
  },

  watch: {
    obsSceneData: {
      handler() {
        this.migrateVisualScenesToSceneUuid()
      },
      deep: true,
    },
  },

  methods: {
    getSceneOptions(obsSceneData: any): any[] {
      const result: any[] = []
      const seen = new Set<string>()

      const addScene = (scene: any, canvas: any = null) => {
        const sceneUuid = String(scene?.sceneUuid ?? scene?.uuid ?? '')
        if (!sceneUuid || seen.has(sceneUuid)) return

        seen.add(sceneUuid)

        const sceneName = String(scene?.sceneName ?? scene?.sceneNameOriginal ?? scene?.name ?? sceneUuid)
        const canvasName = String(canvas?.canvasName ?? canvas?.name ?? '')
        const canvasUuid = String(canvas?.canvasUuid ?? canvas?.uuid ?? '')

        result.push({
          title: canvasName ? `${canvasName} / ${sceneName}` : sceneName,
          value: sceneUuid,
          sceneUuid,
          sceneName,
          canvasUuid,
          canvasName,
        })
      }

      const scanSceneList = (sceneList: any[], canvas: any = null) => {
        for (const scene of sceneList) addScene(scene, canvas)
      }

      const scanCanvasList = (canvasList: any[]) => {
        for (const canvas of canvasList) {
          const scenes = Array.isArray(canvas?.scenes)
            ? canvas.scenes
            : Array.isArray(canvas?.sceneData)
              ? canvas.sceneData
              : Array.isArray(canvas?.sceneList)
                ? canvas.sceneList
                : []

          if (scenes.length) {
            scanSceneList(scenes, canvas)
            continue
          }

          if (canvas?.sceneUuid || canvas?.uuid) addScene(canvas)
        }
      }

      const scanObsSceneData = (value: any) => {
        if (!value) return

        if (Array.isArray(value)) {
          const looksLikeCanvasList = value.some((item: any) => Array.isArray(item?.scenes) || Array.isArray(item?.sceneData) || Array.isArray(item?.sceneList))
          if (looksLikeCanvasList) scanCanvasList(value)
          else scanSceneList(value)
          return
        }

        if (typeof value !== 'object') return

        if (Array.isArray(value.canvasData)) scanCanvasList(value.canvasData)
        if (Array.isArray(value.canvases)) scanCanvasList(value.canvases)
        if (Array.isArray(value.sceneData)) scanSceneList(value.sceneData)
        if (Array.isArray(value.scenes)) scanSceneList(value.scenes)

        for (const item of Object.values(value)) {
          if (!item || typeof item !== 'object') continue
          if (Array.isArray((item as any).canvasData)) scanCanvasList((item as any).canvasData)
          if (Array.isArray((item as any).canvases)) scanCanvasList((item as any).canvases)
          if (Array.isArray((item as any).sceneData)) scanSceneList((item as any).sceneData)
          if (Array.isArray((item as any).scenes)) scanSceneList((item as any).scenes)
        }
      }

      scanObsSceneData(obsSceneData)

      return result.sort((a, b) => a.title.localeCompare(b.title))
    },

    migrateSceneNameToSceneUuid(scene: any) {
      if (!scene || typeof scene !== 'object') return
      if (scene.sceneUuid) return

      const sceneName = String(scene.sceneName ?? scene.name ?? '')
      if (!sceneName) return

      const option = this.sceneOptions.find((item: any) => item.sceneName === sceneName || item.title === sceneName || item.title.endsWith(` / ${sceneName}`))
      if (!option) return

      scene.sceneUuid = option.value
      scene.sceneName = option.sceneName
      scene.canvasUuid = option.canvasUuid ?? scene.canvasUuid ?? ''
      scene.canvasName = option.canvasName ?? scene.canvasName ?? ''
    },

    migrateVisualScenesToSceneUuid() {
      this.visualRotatingScene.scenes = (this.visualRotatingScene.scenes ?? []).map((scene: any) => {
        this.migrateSceneNameToSceneUuid(scene)
        return this.normalizeScenes([scene])[0] ?? scene
      })
    },

    open() {
      return this.loadRotatingScene()
    },

    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      const client = getWebsocketClient()
      if (!client) throw new Error('websocket is not connected')
      const response = await client.request(method, params, timeout)
      return response?.params ?? response
    },

    unwrapResponse(response: any, method = '') {
      const resultKey = method ? `result_${String(method).replace(/[^a-zA-Z0-9_]/g, '_')}` : ''
      const containers = [response, response?.data, response?.payload, response?.result].filter(Boolean)

      if (resultKey) {
        for (const container of containers) {
          if (container && typeof container === 'object' && Object.prototype.hasOwnProperty.call(container, resultKey)) {
            return container[resultKey]
          }
        }
      }

      for (const container of containers) {
        if (container && typeof container === 'object') {
          if (Object.prototype.hasOwnProperty.call(container, 'result')) return container.result
          if (Object.prototype.hasOwnProperty.call(container, 'data')) return container.data
          if (Object.prototype.hasOwnProperty.call(container, 'payload')) return container.payload
        }
      }

      return response
    },

    assertResponse(data: any, fallbackMessage: string) {
      if (data?.error) throw new Error(data.error)
      if (data?.success === false) throw new Error(data?.message ?? fallbackMessage)
      return data
    },

    async requestRotatingSceneEndpoint(method: string, params: Record<string, any> = {}, timeout = 30_000) {
      const response = await this.requestWebsocket(method, params, timeout)
      return this.assertResponse(this.unwrapResponse(response, method), `${method} failed`)
    },

    async loadRotatingScene() {
      this.loadingFile = true
      this.errorMessage = ''

      try {
        if (this.name || this.filePath) {
          const data = await this.requestRotatingSceneEndpoint('rotating_scene_read', {
            name: this.name || undefined,
            path: this.filePath || undefined,
            file: this.filePath || undefined,
          })

          this.content = String(data?.content ?? this.rotatingSceneToYaml(this.rotatingSceneToVisual()))
        } else {
          this.content = this.rotatingSceneToYaml(this.rotatingSceneToVisual())
        }
      } catch (error: any) {
        this.content = this.rotatingSceneToYaml(this.rotatingSceneToVisual())
        this.errorMessage = error?.message ?? ''
      } finally {
        this.parseContentToVisual()
        this.loadingFile = false
      }
    },

    toggleRawMode(value: boolean) {
      if (value) {
        this.syncVisualToContent()
        return
      }

      this.parseContentToVisual()
    },

    async saveRotatingScene() {
      if (!this.visualRotatingScene.name) return

      this.saving = true
      this.errorMessage = ''

      try {
        if (!this.rawMode) this.syncVisualToContent()

        const saveName = this.name || this.visualRotatingScene.name
        const data = await this.requestRotatingSceneEndpoint('rotating_scene_edit', {
          name: saveName,
          path: this.filePath || undefined,
          file: this.filePath || undefined,
          content: this.content,
        })

        this.$emit('saved', data)
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'saving rotating scene failed'
      } finally {
        this.saving = false
      }
    },

    rotatingSceneToVisual(): VisualRotatingScene {
      const item: any = this.rotatingScene ?? {}
      const minutes = Number(item.interval ?? 1)
      const normalized = this.minutesToBestUnit(minutes)
      this.intervalUnit = normalized.unit

      return {
        name: String(item.name ?? this.name ?? ''),
        interval: normalized.value,
        scenes: this.normalizeScenes(item.scenes ?? []),
      }
    },

    minutesToBestUnit(minutes: number) {
      const value = Number.isFinite(minutes) && minutes > 0 ? minutes : 1
      if (value % 60 === 0) return { value: value / 60, unit: 'hours' }
      if (value < 1) return { value: Math.round(value * 60), unit: 'seconds' }
      return { value, unit: 'minutes' }
    },

    normalizeScenes(scenes: any[]): VisualRotatingSceneItem[] {
      if (!Array.isArray(scenes)) return []

      return scenes
        .map((scene: any) => {
          if (typeof scene === 'string') {
            const option = this.sceneOptions.find((item: any) => item.value === scene)
            return {
              sceneUuid: scene,
              sceneName: option?.sceneName ?? scene,
              canvasUuid: option?.canvasUuid ?? '',
              canvasName: option?.canvasName ?? '',
            }
          }

          const sceneUuid = String(scene?.sceneUuid ?? scene?.uuid ?? '')
          if (!sceneUuid) return null

          const option = this.sceneOptions.find((item: any) => item.value === sceneUuid)

          return {
            sceneUuid,
            sceneName: String(scene?.sceneName ?? scene?.name ?? option?.sceneName ?? sceneUuid),
            canvasUuid: String(scene?.canvasUuid ?? option?.canvasUuid ?? ''),
            canvasName: String(scene?.canvasName ?? option?.canvasName ?? ''),
          }
        })
        .filter(Boolean) as VisualRotatingSceneItem[]
    },

    parseContentToVisual() {
      try {
        const parsed: any = this.yamlLoad(this.content) ?? {}
        const minutes = Number(parsed.interval ?? 1)
        const normalized = this.minutesToBestUnit(minutes)

        this.intervalUnit = normalized.unit
        this.visualRotatingScene = {
          name: String(parsed.name ?? this.name ?? ''),
          interval: normalized.value,
          scenes: this.normalizeScenes(parsed.scenes ?? []),
        }

        this.hasVisualErrors = false
      } catch (error: any) {
        this.hasVisualErrors = true
        this.errorMessage = error?.message ?? 'Failed to parse rotating scene YAML'
      }
    },

    exportRotatingSceneData() {
      return {
        name: this.visualRotatingScene.name,
        interval: this.intervalMinutes,
        scenes: (this.visualRotatingScene.scenes ?? []).map((scene) => ({
          sceneUuid: scene.sceneUuid,
          sceneName: scene.sceneName ?? '',
          canvasUuid: scene.canvasUuid ?? '',
          canvasName: scene.canvasName ?? '',
        })),
      }
    },

    importRotatingSceneYaml(payload: any) {
      try {
        const imported = this.yamlLoad(String(payload?.content ?? '')) ?? {}
        if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
          throw new Error('invalid rotating scene yaml')
        }

        this.content = this.yamlDump(imported)
        this.parseContentToVisual()
        this.rawMode = false
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'import failed'
      }
    },

    syncVisualToContent() {
      this.content = this.rotatingSceneToYaml(this.exportRotatingSceneData())
    },

    rotatingSceneToYaml(data: any) {
      return this.yamlDump(data)
    },

    yamlDump(value: any, indent = 0): string {
      const pad = ' '.repeat(indent)

      if (Array.isArray(value)) {
        if (!value.length) return '[]'

        return value.map((item) => {
          if (item && typeof item === 'object') {
            const dumped = this.yamlDump(item, indent + 2)
            return `${pad}-\n${dumped}`
          }
          return `${pad}- ${this.yamlScalar(item)}`
        }).join('\n')
      }

      if (value && typeof value === 'object') {
        return Object.entries(value).map(([key, item]) => {
          if (Array.isArray(item)) {
            if (!item.length) return `${pad}${key}: []`
            return `${pad}${key}:\n${this.yamlDump(item, indent + 2)}`
          }

          if (item && typeof item === 'object') {
            return `${pad}${key}:\n${this.yamlDump(item, indent + 2)}`
          }

          return `${pad}${key}: ${this.yamlScalar(item)}`
        }).join('\n') + '\n'
      }

      return `${pad}${this.yamlScalar(value)}`
    },

    yamlScalar(value: any) {
      if (value === null || value === undefined) return 'null'
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0'
      const stringValue = String(value)
      if (!stringValue || /[:#\n\[\]{}]|^\s|\s$/.test(stringValue)) return JSON.stringify(stringValue)
      return stringValue
    },

    yamlLoad(input: string) {
      const lines = String(input ?? '')
        .replace(/\t/g, '  ')
        .split(/\r?\n/)
        .map((raw) => ({ indent: raw.match(/^ */)?.[0].length ?? 0, text: raw.trim() }))
        .filter((line) => line.text && !line.text.startsWith('#'))

      const parseScalar = (value: string): any => {
        const trimmed = value.trim()
        if (trimmed === '') return ''
        if (trimmed === '[]') return []
        if (trimmed === '{}') return {}
        if (trimmed === 'true') return true
        if (trimmed === 'false') return false
        if (trimmed === 'null') return null
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
        if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
          try {
            return trimmed.startsWith('"') ? JSON.parse(trimmed) : trimmed.slice(1, -1).replace(/''/g, "'")
          } catch (error) {
            return trimmed.slice(1, -1)
          }
        }
        return trimmed
      }

      const setPair = (target: any, pair: string, nextIndex: number, parentIndent: number) => {
        const separatorIndex = pair.indexOf(':')
        if (separatorIndex < 0) return nextIndex

        const key = pair.slice(0, separatorIndex).trim()
        const value = pair.slice(separatorIndex + 1).trim()

        if (value) {
          target[key] = parseScalar(value)
          return nextIndex
        }

        if (nextIndex < lines.length && lines[nextIndex].indent > parentIndent) {
          const child = parseBlock(nextIndex, lines[nextIndex].indent)
          target[key] = child.value
          return child.index
        }

        target[key] = null
        return nextIndex
      }

      const parseObject = (index: number, indent: number): any => {
        const object: Record<string, any> = {}

        while (index < lines.length) {
          const line = lines[index]
          if (line.indent < indent) break
          if (line.indent > indent) {
            index++
            continue
          }
          if (line.text.startsWith('- ')) break
          index = setPair(object, line.text, index + 1, indent)
        }

        return { value: object, index }
      }

      const parseArray = (index: number, indent: number): any => {
        const array: any[] = []

        while (index < lines.length) {
          const line = lines[index]
          if (line.indent < indent) break
          if (line.indent > indent) {
            index++
            continue
          }
          if (!line.text.startsWith('-')) break

          const rest = line.text === '-' ? '' : line.text.slice(2).trim()
          index++

          if (!rest) {
            if (index < lines.length && lines[index].indent > indent) {
              const child = parseBlock(index, lines[index].indent)
              array.push(child.value)
              index = child.index
            } else {
              array.push(null)
            }
            continue
          }

          if (rest.includes(':')) {
            const object: Record<string, any> = {}
            setPair(object, rest, index, indent)

            while (index < lines.length && lines[index].indent > indent) {
              index = setPair(object, lines[index].text, index + 1, lines[index].indent)
            }

            array.push(object)
            continue
          }

          array.push(parseScalar(rest))
        }

        return { value: array, index }
      }

      const parseBlock = (index: number, indent: number): any => {
        if (lines[index]?.text.startsWith('-')) return parseArray(index, indent)
        return parseObject(index, indent)
      }

      if (!lines.length) return {}
      return parseBlock(0, lines[0].indent).value
    },

    addSelectedScene(sceneUuid?: string) {
      const uuid = String(sceneUuid ?? this.selectedSceneUuidToAdd ?? '').trim()
      if (!uuid) return

      const option = this.sceneOptions.find((item: any) => item.value === uuid)
      if (!option) return

      this.visualRotatingScene.scenes = [
        ...(this.visualRotatingScene.scenes ?? []),
        {
          sceneUuid: option.value,
          sceneName: option.sceneName,
          canvasUuid: option.canvasUuid,
          canvasName: option.canvasName,
        },
      ]

      this.selectedSceneUuidToAdd = ''
    },

    removeScene(index: number) {
      this.visualRotatingScene.scenes = (this.visualRotatingScene.scenes ?? []).filter((_: any, sceneIndex: number) => sceneIndex !== index)
    },

    moveSceneUp(index: number) {
      this.moveScene(index, index - 1)
    },

    moveSceneDown(index: number) {
      this.moveScene(index, index + 1)
    },

    moveScene(fromIndex: number, toIndex: number) {
      const scenes = [...(this.visualRotatingScene.scenes ?? [])]

      if (fromIndex < 0 || fromIndex >= scenes.length) return
      if (toIndex < 0 || toIndex >= scenes.length) return

      const [scene] = scenes.splice(fromIndex, 1)
      scenes.splice(toIndex, 0, scene)
      this.visualRotatingScene.scenes = scenes
    },

    getSceneLabel(scene: VisualRotatingSceneItem) {
      const canvasName = String(scene?.canvasName ?? '')
      const sceneName = String(scene?.sceneName ?? scene?.sceneUuid ?? '')
      return canvasName ? `${canvasName} / ${sceneName}` : sceneName
    },
  },
}
</script>

<style scoped lang="scss">
.rotating-scene-editor-dialog__code {
  min-height: 520px;
}

.rotating-scene-editor-dialog__scene-add {
  align-items: center;
}

.rotating-scene-editor-dialog__scene-item {
  background: rgba(255, 255, 255, 0.04);
}

@media (max-width: 700px) {
  .rotating-scene-editor-dialog__scene-add {
    flex-direction: column;
    align-items: stretch;
  }
}

.min-width-0 {
  min-width: 0;
}
</style>
