<template>
  <v-card class="overflow-auto mx-auto" max-height="100%" elevation="0" color="transparent" max-width="100%">
    <v-card-title class="d-flex align-center justify-space-between px-3 pt-3">
      <div class="d-flex align-center ga-2 min-width-0">
        <v-icon icon="mdi-star-circle" />
        <div class="min-width-0">
          <div class="text-truncate">{{ $t('channelPoints.title') }}</div>
        </div>
      </div>

      <div class="d-flex align-center ga-2">
        <v-btn prepend-icon="mdi-plus" color="primary" variant="tonal" @click="openCreateDialog">
          {{ $t('channelPoints.add') }}
        </v-btn>
      </div>
    </v-card-title>

    <v-card-text>
      <v-row density="compact" class="mb-3">
        <v-col cols="12" md="6">
          <StorageCard
            ref="storageCard"
            :hide-channel-point-used="false"
          />
        </v-col>

        <v-col cols="12" md="6">
          <UploadCard
            ref="uploadCard"
            :label="$t('channelPoints.upload') || 'Upload channel points'"
            :drop-label="$t('file.dropFiles') || 'Drop files here'"
            icon="mdi-upload"
            accept=".yaml,.yml,.json"
            :loading="uploading"
            :disabled="workingAction !== null"
            @upload="uploadFiles"
          />
        </v-col>
      </v-row>

      <v-text-field
        v-model="searchQuery"
        :label="$t('channelPoints.search') || 'Search channel points'"
        prepend-inner-icon="mdi-magnify"
        clearable
        variant="outlined"
        density="comfortable"
        hide-details
        class="mb-3"
      />

      <v-alert v-if="errorMessage" type="error" color="red-darken-3" class="mb-4" :text="errorMessage" />
      <v-alert v-if="filteredChannelPoints.length === 0" type="info" color="warning" :text="$t('channelPoints.none') || 'No channel points found'" />

      <v-expansion-panels v-else variant="accordion" class="channel-point-list">
        <ChannelPoint
          v-for="channelPoint in filteredChannelPoints"
          :key="channelPoint.name"
          :channel-point="channelPoint"
          :disabled="workingAction !== null"
          :deleting="workingName === channelPoint.name && workingAction === 'delete'"
          :toggling="workingName === channelPoint.name && workingAction === 'toggle'"
          @edit="openEditDialog"
          @delete="deleteChannelPoint"
          @toggle="toggleChannelPoint"
        />
      </v-expansion-panels>
    </v-card-text>

    <ChannelPointCreateDialog
      ref="createDialog"
      v-model="createDialog"
      :loading="workingAction === 'save'"
      :error="editorError"
      @save="saveChannelPoint"
    />

    <ChannelPointEditorDialog
      ref="editorDialog"
      v-model="editorDialog"
      :channel-point="selectedChannelPoint"
      :loading="workingAction === 'save'"
      :error="editorError"
      @save="saveChannelPoint"
    />
  </v-card>
</template>

<script lang="ts">
import { mapActions, mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'
import StorageCard from '@/components/cards/StorageCard.vue'
import UploadCard from '@/components/cards/UploadCard.vue'
import ChannelPoint from '@/components/ChannelPoint.vue'
import ChannelPointCreateDialog from '@/components/dialogs/ChannelPointCreateDialog.vue'
import ChannelPointEditorDialog from '@/components/dialogs/ChannelPointEditorDialog.vue'

type ChannelPointEntry = {
  name: string
  label: string
  asset: string
  macro: string
  enable_default?: boolean
  auto_accept?: boolean
  strip_emotes?: boolean,
  input_required?: boolean,
  file?: string
  active?: boolean
  id?: string
  background?: string
  image?: string
  raw?: any
}

export default {
  name: 'ChannelPoints',

  components: {
    StorageCard,
    UploadCard,
    ChannelPoint,
    ChannelPointCreateDialog,
    ChannelPointEditorDialog,
  },

  data() {
    return {
      loading: false,
      uploading: false,
      errorMessage: '',
      editorError: '',
      searchQuery: '',
      createDialog: false,
      editorDialog: false,
      selectedChannelPoint: null as ChannelPointEntry | null,
      localChannelPoints: [] as ChannelPointEntry[],
      workingName: null as string | null,
      workingAction: null as null | 'save' | 'delete' | 'toggle',
    }
  },

  computed: {
    ...mapState(useAppStore, ['getChannelPoints']),

    channelPointList(): ChannelPointEntry[] {
      const byKey = new Map<string, ChannelPointEntry>()

      for (const point of this.localChannelPoints) {
        const key = this.channelPointMergeKey(point)
        if (!key) continue

        byKey.set(key, point)
      }

      for (const point of (this.getChannelPoints.all as any[] ?? [])) {
        const label = String(point?.label ?? point?.name ?? '').trim()
        const key = this.channelPointMergeKey(point)

        if (!label || !key) continue

        const existing = byKey.get(key)
        const name = existing?.name ?? this.normalizeChannelPointName(label)
        const generated = this.generatedName(name)

        byKey.set(key, {
          ...(existing ?? {}),
          ...point,
          name,
          label: existing?.label ?? label,
          asset: existing?.asset ?? generated,
          macro: existing?.macro ?? generated,
        })
      }

      return [...byKey.values()].sort((a, b) => String(a.label ?? a.name).localeCompare(String(b.label ?? b.name)))
    },

    filteredChannelPoints(): ChannelPointEntry[] {
      const query = String(this.searchQuery ?? '').trim().toLowerCase()
      if (!query) return this.channelPointList

      return this.channelPointList.filter((point) =>
        [point.name, point.label, point.asset, point.macro]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      )
    },
  },

  methods: {
    ...mapActions(useAppStore, ['setChannelPoints']),

    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 15_000): Promise<any> {
      const websocketClient = getWebsocketClient()

      if (!websocketClient) {
        throw new Error('websocket is not connected')
      }

      const response = await websocketClient.request(method, params ?? {}, timeout)
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

    async requestChannelPointEndpoint(method: string, params: Record<string, any> = {}, timeout = 15_000): Promise<any> {
      const response = await this.requestWebsocket(method, params, timeout)
      const data = this.unwrapWebsocketResponse(response, method)
      return this.assertWebsocketResponse(data, `${method} failed`)
    },

    readFileAsText(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(reader.error ?? new Error('failed to read file'))
        reader.readAsText(file)
      })
    },

    normalizeChannelPointName(value: any): string {
      return String(value ?? '')
        .trim()
        .replace(/^channel_point_/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_.-]+/g, '_')
        .replace(/^_+|_+$/g, '')
    },

    generatedName(name: string): string {
      return `channel_point_${this.normalizeChannelPointName(name)}`
    },

    channelPointMergeKey(point: any): string {
      return String(point?.label ?? point?.name ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_.-]+/g, '_')
        .replace(/^_+|_+$/g, '')
    },

    normalizeChannelPointEntry(raw: any): ChannelPointEntry | null {
      const content = raw?.channel_point ?? raw?.config ?? raw?.raw ?? raw
      const rawFileName = String(raw?.path ?? raw?.file ?? '').replace(/\\/g, '/').split('/').pop()?.replace(/\.(ya?ml|json)$/i, '') ?? ''
      const label = String(content?.label ?? raw?.label ?? content?.name ?? raw?.name ?? '').trim()
      const name = this.normalizeChannelPointName(rawFileName || raw?.name || label)

      if (!name) return null

      return {
        name,
        label: label || name,
        asset: String(content?.asset ?? this.generatedName(name)),
        macro: String(content?.macro ?? this.generatedName(name)),
        enable_default: content?.enable_default === true,
        auto_accept: content?.auto_accept === true,
        strip_emotes: content?.strip_emotes === true,
        input_required: content?.input_required === true,
        file: raw?.path ?? raw?.file ?? `${name}.yaml`,
        active: raw?.active,
        id: raw?.id,
        background: raw?.background,
        image: raw?.image,
        raw: content,
      }
    },

    normalizeListPayload(data: any): ChannelPointEntry[] {
      const source =
        data?.channel_points ??
        data?.channelPoints ??
        data?.points ??
        data?.files ??
        data?.items ??
        data

      if (Array.isArray(source)) {
        return source.map(this.normalizeChannelPointEntry).filter(Boolean) as ChannelPointEntry[]
      }

      if (source && typeof source === 'object') {
        return Object.entries(source)
          .map(([name, value]: [string, any]) => this.normalizeChannelPointEntry({ name, ...(value ?? {}) }))
          .filter(Boolean) as ChannelPointEntry[]
      }

      return []
    },

    async uploadFiles(files: File[] | FileList) {
      const fileList = Array.from(files as any) as File[]
      if (!fileList.length || this.uploading) return

      this.uploading = true
      this.errorMessage = ''

      try {
        const uploadFiles = await Promise.all(fileList.map(async (file) => ({
          name: file.name,
          type: file.type,
          content: await this.readFileAsText(file),
        })))

        const data = await this.requestChannelPointEndpoint('channel_points_upload', {
          files: uploadFiles,
        }, 30_000)

        if (data?.error) throw new Error(data.error)

        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
        ;(this.$refs.uploadCard as any)?.reset?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'channel point upload failed'
      } finally {
        this.uploading = false
      }
    },

    async openCreateDialog() {
      this.editorError = ''
      this.createDialog = true
      await this.$nextTick()
      await (this.$refs.createDialog as any)?.open?.()
    },

    async openEditDialog(channelPoint: ChannelPointEntry) {
      this.selectedChannelPoint = channelPoint
      this.editorError = ''
      this.editorDialog = true
      await this.$nextTick()
      await (this.$refs.editorDialog as any)?.open?.()
    },

    async saveChannelPoint(payload: any) {
      const name = this.normalizeChannelPointName(payload?.name)
      if (!name || this.workingAction) return

      const generated = this.generatedName(name)

      this.workingName = name
      this.workingAction = 'save'
      this.editorError = ''

      try {
        const channelPoint = {
          label: payload.label || name,
          asset: generated,
          macro: generated,
          enable_default: payload.enable_default === true,
          auto_accept: payload.auto_accept === true,
          strip_emotes: payload.strip_emotes === true,
          input_required: payload.input_required === true,
        }

        await this.requestChannelPointEndpoint('assets_edit', {
          path: `${generated}.yaml`,
          name: generated,
          asset: payload.asset ?? {},
        }, 30_000)

        await this.requestChannelPointEndpoint('macro_edit', {
          path: `${generated}.yaml`,
          name: generated,
          content: payload.macroContent ?? this.defaultMacroContent(generated),
        }, 30_000)

        const data = await this.requestChannelPointEndpoint('channel_points_edit', {
          path: `${name}.yaml`,
          name,
          label: channelPoint.label,
          asset: channelPoint.asset,
          macro: channelPoint.macro,
          enable_default: channelPoint.enable_default,
          auto_accept: channelPoint.auto_accept,
          strip_emotes: channelPoint.strip_emotes,
          input_required: channelPoint.input_required,
          channel_point: channelPoint,
          content: this.channelPointToYaml(channelPoint),
        }, 30_000)

        if (data?.error) throw new Error(data.error)

        this.createDialog = false
        this.editorDialog = false

        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.editorError = error?.message ?? 'saving channel point failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },

    defaultMacroContent(name: string) {
      return `name: ${name}\napis: []\ntasks: []\n`
    },

    channelPointToYaml(channelPoint: any) {
      return [
        `label: ${this.yamlScalar(channelPoint.label)}`,
        `asset: ${this.yamlScalar(channelPoint.asset)}`,
        `macro: ${this.yamlScalar(channelPoint.macro)}`,
        `enable_default: ${channelPoint.enable_default === true ? 'true' : 'false'}`,
        `auto_accept: ${channelPoint.auto_accept === true ? 'true' : 'false'}`,
        `strip_emotes: ${channelPoint.strip_emotes === true ? 'true' : 'false'}`,
        `input_required: ${channelPoint.input_required === true ? 'true' : 'false'}`,
        '',
      ].join('\n')
    },

    yamlScalar(value: any) {
      const stringValue = String(value ?? '')
      if (/^[a-zA-Z0-9_.-]+$/.test(stringValue)) return stringValue
      return JSON.stringify(stringValue)
    },

    async deleteChannelPoint(channelPoint: ChannelPointEntry) {
      if (!channelPoint?.name || this.workingAction) return

      this.workingName = channelPoint.name
      this.workingAction = 'delete'
      this.errorMessage = ''

      try {
        const data = await this.requestChannelPointEndpoint('channel_points_delete', {
          path: `${channelPoint.name}.yaml`,
          name: channelPoint.name,
        })
        if (data?.error) throw new Error(data.error)

        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'delete channel point failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },

    async toggleChannelPoint(channelPoint: ChannelPointEntry) {
      if (!channelPoint?.id || this.workingAction) return

      this.workingName = channelPoint.name
      this.workingAction = 'toggle'

      try {
        const data = await this.requestChannelPointEndpoint('toggle_channel_point', {
          channel_point: channelPoint,
          state: 'toggle',
          active: channelPoint.active,
        }, 30_000)

        if (data?.error) throw new Error(data.error)

        channelPoint.active = !channelPoint.active
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'toggle channel point failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },
  },
}
</script>
