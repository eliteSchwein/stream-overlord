<template>
  <MacroTaskAccordionTemplate
    class="macro-task-accordion macro-task-accordion--media"
    :item="item"
    :index="index"
    icon="mdi-multimedia"
    :title="title"
    export-prefix="macro_media"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
    @group:selected="onExpansionChange"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-text-field
          v-model="task.data.target"
          :label="$t('macro.final.media.target')"
          prepend-inner-icon="mdi-crosshairs-gps"
          hide-details="auto"
          variant="outlined"
          density="comfortable"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-menu
          v-model="pathSuggestionsOpen"
          :close-on-content-click="true"
          location="bottom"
          max-height="320"
        >
          <template #activator="{ props }">
            <v-text-field
              v-bind="props"
              v-model="task.data.path"
              :loading="loadingSources"
              :label="$t('macro.final.media.mediaPathURLPlaceholder')"
              :placeholder="$t('macro.final.media.assetsImageWebpHttpsExampleComImagePngVariable')"
              prepend-inner-icon="mdi-link-variant"
              append-inner-icon="mdi-menu-down"
              clearable
              hide-details="auto"
              variant="outlined"
              density="comfortable"
              persistent-placeholder
              @focus="openPathSuggestions"
              @click:append-inner="togglePathSuggestions"
            />
          </template>

          <v-list density="compact">
            <v-list-item
              v-if="!sourceOptions.length"
              :title="$t('macro.final.media.noMediaSuggestionsFound')"
              disabled
            />

            <v-list-item
              v-for="source in sourceOptions"
              :key="source"
              :title="source"
              prepend-icon="mdi-file-image-outline"
              @click="selectPath(source)"
            />
          </v-list>
        </v-menu>
      </v-col>

      <v-col cols="12" md="6">
        <v-select
          v-model="task.data.type"
          :items="typeOptions"
          :label="$t('macro.final.media.type')"
          prepend-inner-icon="mdi-shape-outline"
          clearable
          hide-details="auto"
          variant="outlined"
          density="comfortable"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-switch
          v-model="task.data.clearOnEmpty"
          :label="$t('macro.final.media.clearWhenPathIsEmpty')"
          color="primary"
          hide-details="auto"
          density="comfortable"
        />
      </v-col>

      <v-col cols="12" md="3">
        <v-switch
          v-model="task.data.autoplay"
          :label="$t('macro.final.media.autoplay')"
          color="primary"
          hide-details="auto"
          density="comfortable"
        />
      </v-col>

      <v-col cols="12" md="3">
        <v-switch
          v-model="task.data.loop"
          :label="$t('macro.final.media.loop')"
          color="primary"
          hide-details="auto"
          density="comfortable"
        />
      </v-col>

      <v-col cols="12" md="3">
        <v-switch
          v-model="task.data.muted"
          :label="$t('macro.final.media.muted')"
          color="primary"
          hide-details="auto"
          density="comfortable"
        />
      </v-col>

      <v-col cols="12" md="3">
        <v-switch
          v-model="task.data.controls"
          :label="$t('macro.final.media.controls')"
          color="primary"
          hide-details="auto"
          density="comfortable"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { getWebsocketClient } from '@/plugins/websocketInstance'
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

type MediaEntry = {
  name?: string
  path?: string
  type?: 'file' | 'folder' | string
  asset?: string | { original?: string; compressed?: string | null } | null
  compressed?: string | null
}

const mediaSourceRegex = /\.(jpe?g|png|gif|webp|svg|avif|mp4|webm|mov|m4v|ogg|mp3|wav|opus|oga|m4a|flac|html?)(\?.*)?$/i

export default {
  name: 'MacroMediaTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      loadingSources: false,
      mediaEntries: [] as MediaEntry[],
      mediaLoaded: false,
      pathSuggestionsOpen: false,
      typeOptions: [
        { title: String(this.$t('macro.final.media.autoDetect')), value: null },
        { title: String(this.$t('macro.final.media.image')), value: 'image' },
        { title: String(this.$t('macro.final.media.video')), value: 'video' },
        { title: String(this.$t('macro.final.media.audio')), value: 'audio' },
        { title: String(this.$t('macro.final.media.iframe')), value: 'iframe' },
      ],
    }
  },

  computed: {
    task(): any {
      return (this.item as any).task
    },

    title(): string {
      return `Media: ${this.task.data?.target || this.task.data?.path || 'empty'}`
    },

    sourceOptions(): string[] {
      return this.mediaOptions(mediaSourceRegex, true)
    },
  },

  created() {
    this.ensureData()
  },

  methods: {
    ensureData() {
      this.task.channel = 'media'
      this.task.method = 'show_media'

      if (!this.task.data || typeof this.task.data !== 'object') {
        this.task.data = {}
      }

      if (!this.task.data.target) this.task.data.target = 'default'
      if (this.task.data.clearOnEmpty === undefined) this.task.data.clearOnEmpty = true
      if (this.task.data.autoplay === undefined) this.task.data.autoplay = true
      if (this.task.data.loop === undefined) this.task.data.loop = false
      if (this.task.data.muted === undefined) this.task.data.muted = false
      if (this.task.data.controls === undefined) this.task.data.controls = false

      if (this.task.data.options && typeof this.task.data.options === 'object') {
        Object.assign(this.task.data, this.task.data.options)
        delete this.task.data.options
      }
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

    async openPathSuggestions() {
      this.pathSuggestionsOpen = true

      if (!this.mediaLoaded && !this.loadingSources) {
        await this.fetchMediaEntries()
      }
    },

    async togglePathSuggestions() {
      this.pathSuggestionsOpen = !this.pathSuggestionsOpen

      if (this.pathSuggestionsOpen && !this.mediaLoaded && !this.loadingSources) {
        await this.fetchMediaEntries()
      }
    },

    selectPath(path: string) {
      this.task.data.path = path
      this.pathSuggestionsOpen = false
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
        const normalized = this.normalizeAssetPath(value)

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

      return values.sort((a, b) => a.localeCompare(b))
    },

    normalizeAssetPath(value: any): string {
      return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .trim()
    },

    getEntryOriginal(entry: MediaEntry): string {
      if (typeof entry.asset === 'object' && entry.asset?.original) {
        return this.normalizeAssetPath(entry.asset.original)
      }

      if (typeof entry.asset === 'string') {
        return this.normalizeAssetPath(entry.asset)
      }

      return this.normalizeAssetPath(entry.path ?? entry.name)
    },

    getEntryCompressed(entry: MediaEntry): string {
      if (typeof entry.compressed === 'string') {
        return this.normalizeAssetPath(entry.compressed)
      }

      if (typeof entry.asset === 'object' && typeof entry.asset?.compressed === 'string') {
        return this.normalizeAssetPath(entry.asset.compressed)
      }

      return ''
    },
  },
}
</script>
