<template>
  <v-card class="overflow-auto mx-auto" max-height="100%" elevation="0" color="transparent" max-width="100%">
    <v-card-title class="d-flex align-center justify-space-between px-3 pt-3">
      <div class="d-flex align-center ga-2 min-width-0">
        <v-icon icon="mdi-filmstrip" />
        <div class="min-width-0">
          <div class="text-truncate">Scene rotation</div>
        </div>
      </div>

      <div class="d-flex align-center ga-2">
        <v-btn
          prepend-icon="mdi-refresh"
          variant="tonal"
          :loading="loading"
          @click="loadRotatingScenes"
        >
          {{ $t('common.refresh') }}
        </v-btn>

        <v-btn
          prepend-icon="mdi-plus"
          color="primary"
          variant="tonal"
          @click="openCreateEditor"
        >
          Create
        </v-btn>
      </div>
    </v-card-title>

    <v-card-text>
      <v-row density="compact" class="mb-3">
        <v-col cols="12" md="6">
          <StorageCard
            ref="storageCard"
            :hide-rotating-scene-used="false"
          />
        </v-col>

        <v-col cols="12" md="6">
          <UploadCard
            ref="uploadCard"
            label="Upload rotating scene"
            :drop-label="$t('file.dropFiles') || 'Drop files here'"
            icon="mdi-upload"
            accept=".yaml,.yml,.json"
            :loading="uploading"
            @upload="uploadFiles"
          />
        </v-col>
      </v-row>

      <v-text-field
        v-model="searchQuery"
        label="Search rotating scenes"
        prepend-inner-icon="mdi-magnify"
        clearable
        variant="outlined"
        density="comfortable"
        hide-details
        class="mb-3"
      />

      <v-alert
        v-if="errorMessage"
        type="error"
        color="red-darken-3"
        class="mb-4"
        :text="errorMessage"
      />

      <v-alert
        v-if="!loading && filteredRotatingScenes.length === 0"
        type="info"
        color="grey-darken-3"
        text="No rotating scenes found"
      />

      <div v-else class="rotating-scene-list">
        <RotatingScene
          v-for="item in filteredRotatingScenes"
          :key="item.path || item.name"
          :rotating-scene="item.rotatingScene"
          @edit="openEditor"
          @delete="openDeleteDialog"
        />
      </div>
    </v-card-text>

    <RotatingSceneEditorDialog
      ref="rotatingSceneEditorDialog"
      v-model="editorDialog"
      :name="selectedRotatingSceneName"
      :rotating-scene="selectedRotatingScene"
      :file-path="selectedRotatingSceneFile"
      :loading="workingAction === 'save' || workingAction === 'read'"
      @saved="handleEditorSaved"
    />

    <RotatingSceneDeleteConfirmDialog
      v-model="deleteDialog"
      :name="selectedDeleteName"
      :rotating-scene="selectedDeleteRotatingScene"
      :loading="workingAction === 'delete'"
      @confirm="confirmDeleteRotatingScene"
    />
  </v-card>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'
import StorageCard from '@/components/cards/StorageCard.vue'
import UploadCard from '@/components/cards/UploadCard.vue'
import RotatingScene from '@/components/RotatingScene.vue'
import RotatingSceneEditorDialog from '@/components/dialogs/RotatingSceneEditorDialog.vue'
import RotatingSceneDeleteConfirmDialog from '@/components/dialogs/RotatingSceneDeleteConfirmDialog.vue'
import eventBus from "@/eventBus.ts";

type RotatingSceneEntry = {
  name: string
  path: string
  rotatingScene: any
}

export default {
  name: 'RotatingScenes',

  components: {
    StorageCard,
    UploadCard,
    RotatingScene,
    RotatingSceneEditorDialog,
    RotatingSceneDeleteConfirmDialog,
  },

  data() {
    return {
      searchQuery: '',
      loading: false,
      uploading: false,
      errorMessage: '',
      editorDialog: false,
      deleteDialog: false,
      rotatingScenes: [] as RotatingSceneEntry[],
      selectedRotatingSceneName: '',
      selectedRotatingScene: null as any,
      selectedRotatingSceneFile: '',
      selectedDeleteName: '',
      selectedDeleteRotatingScene: null as any,
      workingName: null as string | null,
      workingAction: null as string | null,
    }
  },

  computed: {
    ...mapState(useAppStore, ['getRestApi']),

    filteredRotatingScenes(): RotatingSceneEntry[] {
      const query = String(this.searchQuery ?? '').trim().toLowerCase()

      if (!query) return this.rotatingScenes

      return this.rotatingScenes.filter((item) => {
        return (
          item.name.toLowerCase().includes(query) ||
          item.path.toLowerCase().includes(query) ||
          JSON.stringify(item.rotatingScene ?? {}).toLowerCase().includes(query)
        )
      })
    },
  },

  mounted() {
    eventBus.$on?.('websocket:connected', this.loadRotatingScenes)
  },

  beforeUnmount() {
    eventBus.$off?.('websocket:connected', this.loadRotatingScenes)
  },

  methods: {
    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      const client = getWebsocketClient()

      if (!client) {
        throw new Error('websocket is not connected')
      }

      const response = await client.request(method, params, timeout)
      return response?.params ?? response
    },

    getWebsocketResultKey(method: string) {
      return `result_${String(method ?? '').replace(/[^a-zA-Z0-9_]/g, '_')}`
    },

    unwrapWebsocketResponse(response: any, method = ''): any {
      const resultKey = method ? this.getWebsocketResultKey(method) : ''
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

    assertWebsocketResponse(data: any, fallbackMessage: string) {
      if (data?.error) {
        throw new Error(data.error)
      }

      if (data?.success === false) {
        throw new Error(data?.message ?? fallbackMessage)
      }

      return data
    },

    async requestRotatingSceneEndpoint(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      const response = await this.requestWebsocket(method, params, timeout)
      const data = this.unwrapWebsocketResponse(response, method)
      return this.assertWebsocketResponse(data, `${method} failed`)
    },

    async loadRotatingScenes() {
      this.loading = true
      this.errorMessage = ''

      try {
        const listResponse = await this.requestRotatingSceneEndpoint('rotating_scene_list')
        const files = Array.isArray(listResponse?.files) ? listResponse.files : []
        const fileEntries = files.filter((file: any) => file?.type === 'file')
        const result: RotatingSceneEntry[] = []

        for (const file of fileEntries) {
          try {
            const readResponse = await this.requestRotatingSceneEndpoint('rotating_scene_read', {
              path: file.path,
              file: file.path,
            })
            const content = String(readResponse?.content ?? '')
            const parsed = this.parseRotatingSceneContent(content)
            const name = String(parsed?.name ?? file.name?.replace(/\.(yaml|yml|json)$/i, '') ?? '')

            result.push({
              name,
              path: String(readResponse?.path ?? file.path ?? ''),
              rotatingScene: {
                ...parsed,
                name,
                file: String(readResponse?.path ?? file.path ?? ''),
              },
            })
          } catch (error) {
            console.warn(error)
          }
        }

        this.rotatingScenes = result.sort((a, b) => a.name.localeCompare(b.name))
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'loading rotating scenes failed'
      } finally {
        this.loading = false
      }
    },

    parseRotatingSceneContent(content: string) {
      const trimmed = String(content ?? '').trim()
      if (!trimmed) return {}

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return JSON.parse(trimmed)
      }

      return this.yamlLoad(trimmed)
    },

    async uploadFiles(files: File[] | FileList) {
      const fileList = Array.from(files as any)

      if (fileList.length === 0) return

      this.uploading = true
      this.errorMessage = ''

      try {
        const formData = new FormData()

        fileList.forEach((file) => {
          formData.append('files', file)
        })

        const response = await fetch(`${this.getRestApi}/api/rotating_scene/upload`, {
          method: 'POST',
          body: formData,
        })

        const data = await response.json().catch(() => ({}))
        const payload = data?.data ?? data

        if (!response.ok || payload?.error) {
          throw new Error(payload?.message ?? payload?.error ?? 'rotating scene upload failed')
        }

        await this.loadRotatingScenes()
        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'rotating scene upload failed'
      } finally {
        this.uploading = false
      }
    },

    openCreateEditor() {
      this.selectedRotatingSceneName = ''
      this.selectedRotatingScene = {
        name: 'rotating_scene',
        interval: 1,
        scenes: [],
      }
      this.selectedRotatingSceneFile = ''
      this.editorDialog = true
      this.$nextTick(() => {
        ;(this.$refs.rotatingSceneEditorDialog as any)?.open?.()
      })
    },

    openEditor(rotatingScene: any) {
      const name = String(rotatingScene?.name ?? '')

      this.selectedRotatingSceneName = name
      this.selectedRotatingScene = rotatingScene
      this.selectedRotatingSceneFile = rotatingScene?.file ?? `${name}.yaml`
      this.editorDialog = true
      this.$nextTick(() => {
        ;(this.$refs.rotatingSceneEditorDialog as any)?.open?.()
      })
    },

    openDeleteDialog(rotatingScene: any) {
      const name = String(rotatingScene?.name ?? '')

      this.selectedDeleteName = name
      this.selectedDeleteRotatingScene = rotatingScene
      this.deleteDialog = true
    },

    async confirmDeleteRotatingScene() {
      if (!this.selectedDeleteName || this.workingAction) return

      this.workingName = this.selectedDeleteName
      this.workingAction = 'delete'
      this.errorMessage = ''

      try {
        await this.requestRotatingSceneEndpoint('rotating_scene_delete', {
          path: this.selectedDeleteRotatingScene?.file ?? undefined,
          name: this.selectedDeleteName,
        })

        this.deleteDialog = false
        this.selectedDeleteName = ''
        this.selectedDeleteRotatingScene = null
        this.selectedRotatingSceneFile = ''

        await this.loadRotatingScenes()
        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'delete rotating scene failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },

    async handleEditorSaved() {
      this.editorDialog = false
      await this.loadRotatingScenes()
      await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
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
          if (line.text.startsWith('-')) break
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
  },
}
</script>

<style scoped lang="scss">
.rotating-scene-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.min-width-0 {
  min-width: 0;
}
</style>
