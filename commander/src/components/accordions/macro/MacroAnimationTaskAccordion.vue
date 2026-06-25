<template>
  <v-expansion-panel
    class="macro-task-accordion macro-task-accordion--animation"
    @group:selected="onExpansionChange"
  >
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-animation-play" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">{{ title }}</span>
        <v-spacer />
        <v-chip size="x-small" variant="tonal">animation</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-row density="comfortable">
        <v-col cols="12" md="6">
          <v-text-field
            v-model="task.data.target"
            label="Target"
            prepend-inner-icon="mdi-crosshairs-gps"
            hide-details="auto"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-autocomplete
            v-model="task.data.src"
            :items="sourceOptions"
            :loading="loadingSources"
            label="Source"
            prepend-inner-icon="mdi-file-code"
            clearable
            hide-details="auto"
            variant="outlined"
            density="comfortable"
            @update:model-value="task.data.src = normalizePath($event)"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-number-input
            v-model="task.data.startFrame"
            label="Start frame"
            prepend-inner-icon="mdi-ray-start"
            hide-details="auto"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-number-input
            v-model="task.data.stopFrame"
            label="Stop frame"
            prepend-inner-icon="mdi-ray-end"
            hide-details="auto"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-number-input
            v-model="task.data.speed"
            label="Speed"
            prepend-inner-icon="mdi-speedometer"
            hide-details="auto"
            variant="outlined"
            density="comfortable"
            :step="0.1"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-combobox
            v-model="task.data.frameRate"
            :items="frameRateOptions"
            label="Frame rate"
            prepend-inner-icon="mdi-filmstrip"
            clearable
            hide-details="auto"
            variant="outlined"
            density="comfortable"
            @update:model-value="task.data.frameRate = toNullableNumber($event)"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-switch
            v-model="task.data.loop"
            label="Loop"
            color="primary"
            hide-details="auto"
            density="comfortable"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-switch
            v-model="task.data.reverse"
            label="Reverse"
            color="primary"
            hide-details="auto"
            density="comfortable"
          />
        </v-col>

        <v-col cols="12">
          <v-textarea
            v-model="variablesText"
            label="Variables"
            prepend-inner-icon="mdi-code-json"
            rows="4"
            auto-grow
            hide-details="auto"
            variant="outlined"
            density="comfortable"
            @blur="syncVariablesFromText"
          />
        </v-col>
      </v-row>

      <div class="d-flex justify-end ga-2 mt-2">
        <v-btn icon="mdi-arrow-up" size="small" variant="text" @click="$emit('move-up')" />
        <v-btn icon="mdi-arrow-down" size="small" variant="text" @click="$emit('move-down')" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="$emit('remove')" />
      </div>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
import { getWebsocketClient } from '@/plugins/websocketInstance'
import { useAppStore } from '@/stores/app'

type MediaEntry = {
  name?: string
  path?: string
  type?: 'file' | 'folder' | string
  asset?: string | { original?: string; compressed?: string | null } | null
  compressed?: string | null
}

const animationSourceRegex = /\.(svg|json|lottie)$/i

export default {
  name: 'MacroAnimationTaskAccordion',

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      frameRateOptions: [60, 45, 30],
      loadingSources: false,
      mediaEntries: [] as MediaEntry[],
      mediaLoaded: false,
      variablesText: '',
    }
  },

  computed: {
    task(): any {
      return (this.item as any).task
    },

    title(): string {
      return `Animation: ${this.task.data?.target || this.task.data?.src || this.task.method || 'empty'}`
    },

    sourceOptions(): string[] {
      return this.mediaOptions(animationSourceRegex, false)
    },
  },

  created() {
    this.ensureData()
    this.variablesText = this.stringifyVariables(this.task.data.variables)
  },


  methods: {
    ensureData() {
      if (!this.task.data || typeof this.task.data !== 'object') {
        this.task.data = {}
      }

      if (this.task.data.speed === undefined) this.task.data.speed = 1
      if (this.task.data.loop === undefined) this.task.data.loop = false
      if (this.task.data.reverse === undefined) this.task.data.reverse = false
    },

    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 15_000): Promise<any> {
      const client = getWebsocketClient()

      if (!client) {
        throw new Error('websocket is not connected')
      }

      const response = await client.request(method, params, timeout)
      return response?.params ?? response
    },

    async onExpansionChange(event: any) {
      const expanded = typeof event === 'boolean' ? event : Boolean(event?.value)

      if (!expanded || this.mediaLoaded || this.loadingSources) return

      await this.fetchMediaEntries()
    },

    async requestMediaList(path: string = ''): Promise<any> {
      const appStore = useAppStore()

      try {
        const response = await this.requestWebsocket('media_list', { path })
        return response?.data ?? response
      } catch (websocketError) {
        const response = await fetch(`${appStore.getRestApi}/api/assets/media/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        })

        const data = await response.json().catch(() => ({}))
        const responseData = data?.data ?? data

        if (!response.ok || responseData?.error || data?.error) {
          throw new Error(responseData?.error ?? data?.error ?? 'media list failed')
        }

        return responseData
      }
    },

    async fetchMediaEntries(path: string = ''): Promise<MediaEntry[]> {
      if (!path) this.loadingSources = true

      try {
        const data = await this.requestMediaList(path)
        const files = Array.isArray(data?.files) ? data.files : []
        const result: MediaEntry[] = []

        for (const entry of files) {
          result.push(entry)

          if (entry?.type === 'folder' && entry?.path) {
            result.push(...await this.fetchMediaEntries(entry.path))
          }
        }

        if (!path) {
          this.mediaEntries = result.filter((entry) => entry?.type === 'file')
          this.mediaLoaded = true
        }
        return result
      } catch (error) {
        if (!path) {
          this.mediaEntries = []
          this.mediaLoaded = false
        }
        return []
      } finally {
        if (!path) this.loadingSources = false
      }
    },

    mediaOptions(regex: RegExp, compressedFirst: boolean): string[] {
      const values: string[] = []
      const add = (value: any) => {
        const normalized = this.normalizePath(value)
        if (!normalized || !regex.test(normalized)) return
        regex.lastIndex = 0
        if (!values.includes(normalized)) values.push(normalized)
      }

      for (const entry of this.mediaEntries as MediaEntry[]) {
        if (!entry || entry.type !== 'file') continue

        const original = this.getEntryOriginal(entry)
        const compressed = this.getEntryCompressed(entry)

        if (compressedFirst) {
          add(compressed)
          add(original)
        } else {
          add(original)
          add(compressed)
        }
      }

      const current = this.normalizePath(this.task.data?.src)
      if (current && regex.test(current) && !values.includes(current)) values.unshift(current)
      regex.lastIndex = 0

      return values.sort((a, b) => a.localeCompare(b))
    },

    normalizePath(value: any): string {
      return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .trim()
    },

    getEntryOriginal(entry: MediaEntry): string {
      if (typeof entry.asset === 'object' && entry.asset?.original) {
        return this.normalizePath(entry.asset.original)
      }
      if (typeof entry.asset === 'string') {
        return this.normalizePath(entry.asset)
      }
      return this.normalizePath(entry.path ?? entry.name)
    },

    getEntryCompressed(entry: MediaEntry): string {
      if (typeof entry.compressed === 'string') {
        return this.normalizePath(entry.compressed)
      }
      if (typeof entry.asset === 'object' && typeof entry.asset?.compressed === 'string') {
        return this.normalizePath(entry.asset.compressed)
      }
      return ''
    },

    toNullableNumber(value: any): number | null {
      if (value === undefined || value === null || value === '') return null

      const rawValue = typeof value === 'object'
        ? value.value ?? value.raw?.value ?? value.raw ?? value.title
        : value

      const numberValue = Number(rawValue)
      return Number.isFinite(numberValue) ? numberValue : null
    },

    stringifyVariables(value: any): string {
      if (!value || typeof value !== 'object') return ''

      try {
        return JSON.stringify(value, null, 2)
      } catch (error) {
        return ''
      }
    },

    syncVariablesFromText() {
      const value = String(this.variablesText ?? '').trim()

      if (!value) {
        delete this.task.data.variables
        return
      }

      try {
        this.task.data.variables = JSON.parse(value)
      } catch (error) {
        this.task.data.variables = value
      }
    },
  },
}
</script>
