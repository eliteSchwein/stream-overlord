<template>
  <div class="channel-point-asset-accordion">
    <v-alert
      v-if="errorMessage && !errorMessage.includes('file not found')"
      type="error"
      color="red-darken-3"
      density="comfortable"
      class="mb-3"
      :text="errorMessage"
    />

    <v-form>
      <div class="asset-form-section">
        <div class="asset-form-section__label">{{ $t('assets.general') }}</div>
        <v-row density="comfortable">
          <v-col cols="12">
            <v-combobox
              v-model="form.channel"
              :disabled="loadingInternal || disabled"
              :label="$t('assets.channel')"
              hide-details="auto"
              prepend-inner-icon="mdi-broadcast"
              variant="outlined"
            />
          </v-col>
        </v-row>
      </div>

      <div class="asset-form-section">
        <div class="asset-form-section__label">{{ $t('assets.message') }}</div>
        <v-row density="comfortable">
          <v-col cols="12">
            <v-text-field
              v-model="form.message"
              :disabled="loadingInternal || disabled"
              :label="$t('assets.message')"
              hide-details="auto"
              prepend-inner-icon="mdi-message-text"
              variant="outlined"
            />
          </v-col>
        </v-row>
      </div>

      <div class="asset-form-section">
        <div class="asset-form-section__label">{{ $t('assets.media') }}</div>
        <v-row density="comfortable">
          <v-col cols="12" md="4">
            <v-autocomplete
              v-model="form.sound"
              :disabled="loadingInternal || disabled"
              :items="soundOptions"
              :label="$t('assets.sound')"
              clearable
              hide-details="auto"
              prepend-inner-icon="mdi-volume-high"
              variant="outlined"
              @focus="ensureMediaEntries"
              @click="ensureMediaEntries"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-autocomplete
              v-model="form.image"
              :disabled="loadingInternal || disabled"
              :items="imageOptions"
              :label="$t('assets.image')"
              clearable
              hide-details="auto"
              prepend-inner-icon="mdi-image"
              variant="outlined"
              @focus="ensureMediaEntries"
              @click="ensureMediaEntries"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-autocomplete
              v-model="form.video"
              :disabled="loadingInternal || disabled"
              :items="videoOptions"
              :label="$t('assets.video')"
              clearable
              hide-details="auto"
              prepend-inner-icon="mdi-video"
              variant="outlined"
              @focus="ensureMediaEntries"
              @click="ensureMediaEntries"
            />
          </v-col>
        </v-row>
      </div>

      <div class="asset-form-section">
        <div class="asset-form-section__label">{{ $t('assets.timing') }}</div>
        <v-row density="comfortable">
          <v-col cols="12" md="6">
            <v-number-input
              v-model="form.duration"
              :disabled="loadingInternal || disabled"
              :label="$t('assets.duration')"
              :step="0.1"
              hide-details="auto"
              prepend-inner-icon="mdi-timer"
              suffix="s"
              variant="outlined"
              :precision="2"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-number-input
              v-model="volumePercent"
              :disabled="loadingInternal || disabled"
              :label="$t('assets.volume')"
              :max="100"
              :min="0"
              :step="1"
              hide-details="auto"
              :prepend-inner-icon="volumeIcon"
              suffix="%"
              variant="outlined"
              :precision="0"
            />
          </v-col>
        </v-row>
      </div>

      <div class="asset-form-section">
        <div class="asset-form-section__label">{{ $t('assets.theme') }}</div>
        <v-row density="comfortable">
          <v-col cols="12" md="6">
            <v-menu v-model="colorMenu" :close-on-content-click="false">
              <template #activator="{ props }">
                <v-text-field
                  v-model="form.color"
                  :disabled="loadingInternal || disabled"
                  :label="$t('assets.color')"
                  hide-details="auto"
                  prepend-inner-icon="mdi-palette"
                  v-bind="props"
                  variant="outlined"
                >
                  <template #append-inner>
                    <div :style="{ backgroundColor: normalizedColor }" class="asset-color-preview" />
                  </template>
                </v-text-field>
              </template>
              <v-card color="grey-darken-3">
                <v-color-picker v-model="normalizedColor" hide-inputs mode="hex" />
              </v-card>
            </v-menu>
          </v-col>
          <v-col cols="12" md="6">
            <v-combobox
              v-model="form.icon"
              :disabled="loadingInternal || disabled"
              :items="iconOptions"
              :label="$t('assets.icon')"
              clearable
              hide-details="auto"
              prepend-inner-icon="mdi-emoticon"
              variant="outlined"
              @update:model-value="form.icon = normalizeIconName($event)"
            >
              <template #item="{ props, item }">
                <v-list-item v-bind="props">
                  <template #prepend>
                    <v-icon :icon="iconValue(item?.raw ?? item?.title ?? item?.value)" />
                  </template>
                  <v-list-item-title>{{ normalizeIconName(item?.raw ?? item?.title ?? item?.value) }}</v-list-item-title>
                </v-list-item>
              </template>
              <template #chip="{ props }">
                <v-chip :prepend-icon="iconValue(form.icon)" v-bind="props" />
              </template>
            </v-combobox>
          </v-col>
        </v-row>
      </div>

      <div class="asset-form-section">
        <div class="asset-form-section__label">{{ $t('assets.macros') }}</div>
        <v-row density="comfortable">
          <v-col cols="12" md="4">
            <v-combobox v-model="form.start_macros" :disabled="loadingInternal || disabled" :items="macroOptions" :label="$t('assets.startMacros')" chips closable-chips hide-details="auto" multiple variant="outlined" />
          </v-col>
          <v-col cols="12" md="4">
            <v-combobox v-model="form.idle_macros" :disabled="loadingInternal || disabled" :items="macroOptions" :label="$t('assets.idleMacros')" chips closable-chips hide-details="auto" multiple variant="outlined" />
          </v-col>
          <v-col cols="12" md="4">
            <v-combobox v-model="form.end_macros" :disabled="loadingInternal || disabled" :items="macroOptions" :label="$t('assets.endMacros')" chips closable-chips hide-details="auto" multiple variant="outlined" />
          </v-col>
        </v-row>
      </div>

      <v-divider class="my-4" />

      <div class="d-flex align-center justify-space-between mb-3">
        <div class="text-subtitle-2">{{ $t('assets.wled') }}</div>
        <v-btn
          :disabled="loadingInternal || disabled"
          prepend-icon="mdi-plus"
          size="small"
          variant="tonal"
          @click="addWledControl"
        >
          {{ $t('assets.addWled') }}
        </v-btn>
      </div>

      <MacroWledControlEditor
        v-for="(control, index) in form.wled"
        :key="index"
        v-model="form.wled[index]"
        @remove="removeWledControl(index)"
        class="mb-3"
      />
      <div class="d-flex justify-end mt-4">
        <YamlImportExportButtons
          :filename="`${name || 'asset'}.yaml`"
          :export-data="getAssetPayload()"
          :disabled="loadingInternal || disabled"
          @import="importAssetYaml"
          @error="errorMessage = $event?.message ?? $t('assets.importFailed')"
        />
      </div>
    </v-form>
  </div>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import {getWebsocketClient} from "@/plugins/websocketInstance.ts";
import YamlImportExportButtons from '@/components/YamlImportExportButtons.vue'
import MacroWledControlEditor from '@/components/MacroWledControlEditor.vue'

type WledControl = {
  name: string
  red: number | null
  green: number | null
  blue: number | null
  white: number | null
  effect: number | null
  brightness: number | null
}

type MediaEntry = {
  name: string
  path: string
  type: 'file' | 'folder'
  asset?: string | { original?: string; compressed?: string | null } | null
  compressed?: string | null
}

const emptyForm = () => ({
  sound: '',
  icon: '',
  message: '',
  duration: null as number | null,
  color: '',
  channel: '',
  volume: null as number | null,
  image: '',
  video: '',
  start_macros: [] as string[],
  idle_macros: [] as string[],
  end_macros: [] as string[],
  wled: [] as WledControl[],
})

const mdiSuggestions = [
  'alert', 'bell', 'bell-ring', 'bullhorn', 'cash', 'cash-multiple', 'charity', 'chat',
  'chat-alert', 'crown', 'emoticon', 'emoticon-cool', 'fire', 'gift', 'heart',
  'heart-pulse', 'information', 'lightning-bolt', 'party-popper', 'pistol', 'rocket',
  'star', 'star-four-points', 'trophy', 'video', 'volume-high', 'led-strip-variant',
  'test-tube', 'account', 'account-heart', 'gamepad-variant', 'sword', 'shield',
  'skull', 'ghost', 'timer', 'clock', 'camera', 'microphone', 'dice-6',
  'controller-classic', 'youtube', 'twitch', 'discord',
].sort()

export default {
  name: 'ChannelPointAssetAccordion',

  components: {
    YamlImportExportButtons,
    MacroWledControlEditor,
  },

  props: {
    name: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    initialAsset: { type: Object, default: null },
  },

  data() {
    return {
      appStore: useAppStore(),
      form: emptyForm(),
      colorMenu: false,
      wledColorMenus: [] as boolean[],
      mediaEntries: [] as MediaEntry[],
      localMacroItems: [] as string[],
      pendingWledControlIndex: null as number | null,
      wledEffectsByLamp: {} as Record<string, Array<{ title: string; value: number }>>,
      errorMessage: '',
      loadingInternal: false,
      mdiSuggestions,
    }
  },

  computed: {
    volumePercent: {
      get(): number {
        const volume = Number(this.form.volume ?? 1)
        if (!Number.isFinite(volume)) return 100
        return Math.round(Math.min(1, Math.max(0, volume)) * 100)
      },
      set(value: number | string | null) {
        const percent = Math.min(100, Math.max(0, Number(value) || 0))
        this.form.volume = percent / 100
      },
    },

    volumeIcon(): string {
      const volume = Number(this.volumePercent ?? 0)

      if (!Number.isFinite(volume) || volume <= 0) return "mdi-volume-off"
      if (volume <= 33) return "mdi-volume-low"
      if (volume <= 66) return "mdi-volume-medium"
      return "mdi-volume-high"
    },

    normalizedColor: {
      get(): string {
        const value = String(this.form.color ?? '').trim()
        if (!value) return '#66BB6A'
        return value.startsWith('#') ? value : `#${value}`
      },
      set(value: string) {
        this.form.color = String(value ?? '').replace(/^#/, '').toUpperCase()
      },
    },

    macroOptions(): string[] {
      const storeMacros = this.appStore.getMacros ?? {}
      const storeMacroNames = Array.isArray(storeMacros)
        ? storeMacros.map((item: any) => (typeof item === 'string' ? item : item?.name))
        : Object.keys(storeMacros)

      return [...new Set([...storeMacroNames, ...this.localMacroItems].filter(Boolean).map(String))]
        .sort((a, b) => a.localeCompare(b))
    },

    wledOptions(): string[] {
      return this.getWledConfigEntries()
        .map((item: any) => item.name)
        .filter(Boolean)
        .map(String)
        .sort((a: string, b: string) => a.localeCompare(b))
    },

    iconOptions(): string[] {
      const current = this.normalizeIconName(this.form.icon)
      const options = [...this.mdiSuggestions]
      if (current && !options.includes(current)) options.unshift(current)
      return options
    },

    soundOptions(): string[] {
      return this.mediaOptions(/\.(mp3|flac|wav|ogg|m4a|opus)$/i, false)
    },

    imageOptions(): string[] {
      return this.mediaOptions(/\.(webp|jpe?g|png|gif|svg)$/i, true)
    },

    videoOptions(): string[] {
      return this.mediaOptions(/\.(webm|mp4|mov|mkv)$/i, true)
    },
  },

  mounted() {
    this.bootstrap()
  },

  beforeUnmount() {
  },

  methods: {
    isTimeoutError(error: any) {
      const message = String(error?.message ?? error ?? '').toLowerCase()
      return message.includes('timeout') || message.includes('timed out') || message.includes('request timed out')
    },

    async bootstrap() {
      await this.ensureBaseData()

      if (this.initialAsset && Object.keys(this.initialAsset ?? {}).length) {
        this.setAsset(this.initialAsset)
        return
      }

      if (this.name) await this.open(this.name)
    },

    requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 15_000): Promise<any> {
      const client = getWebsocketClient()

      if (!client) {
        return Promise.reject(new Error('websocket is not connected'))
      }

      return client.request(method, params, timeout)
    },

    unwrapWebsocketResponse(response: any, method: string): any {
      const resultKey = `result_${method}`
      const params = response?.params ?? response

      const candidates = [
        params?.[resultKey],
        params?.data?.[resultKey],
        params?.payload?.[resultKey],
        params?.result?.[resultKey],
        response?.[resultKey],
        response?.data?.[resultKey],
        response?.payload?.[resultKey],
        response?.result?.[resultKey],
        params?.data,
        params?.payload,
        params?.result,
        params,
        response?.data,
        response?.payload,
        response?.result,
        response,
      ]

      for (const candidate of candidates) {
        if (candidate !== undefined && candidate !== null) return candidate
      }

      return {}
    },

    async requestEndpoint(method: string, endpoint: string, params: Record<string, any> = {}, timeout = 15_000): Promise<any> {
      // Streambot config/list APIs here use websocket only.
      // REST/fetch is intentionally only used for WLED HTTP endpoints below.
      void endpoint

      const response = await this.requestWebsocket(method, params, timeout)
      const data = this.unwrapWebsocketResponse(response, method)

      if (data?.error) {
        throw new Error(data.error)
      }

      return data
    },

    parseMaybeJson(value: any): any {
      if (typeof value !== 'string') return value

      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    },

    looksLikeAssetConfig(value: any): boolean {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false

      return [
        'sound', 'image', 'video', 'icon', 'message', 'duration', 'color', 'channel', 'volume',
        'start_macros', 'idle_macros', 'end_macros', 'wled',
      ].some((key) => Object.prototype.hasOwnProperty.call(value, key))
    },

    extractAssetFromReadResponse(data: any): any {
      const parsed = this.parseMaybeJson(data)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

      // assets_read returns exactly this shape:
      // { path: "channel_point_Fail.yaml", content: { video, duration, volume, ... } }
      // The old code returned the wrapper object, so setAsset() saw asset.video as undefined.
      const candidates = [
        this.parseMaybeJson(parsed.content),
        this.parseMaybeJson(parsed.result_assets_read?.content),
        this.parseMaybeJson(parsed.data?.result_assets_read?.content),
        this.parseMaybeJson(parsed.payload?.result_assets_read?.content),
        parsed.asset,
        parsed.config?.asset,
        parsed.config,
        parsed.raw?.asset,
        parsed.raw,
        parsed.file?.asset,
        parsed.file,
        parsed,
      ]

      for (const candidate of candidates) {
        if (this.looksLikeAssetConfig(candidate)) {
          return candidate
        }
      }

      // Last fallback: avoid returning the read wrapper if it only has path/content.
      const content = this.parseMaybeJson(parsed.content)
      if (content && typeof content === 'object' && !Array.isArray(content)) return content

      return {}
    },

    async readAsset(name = this.name): Promise<any> {
      const assetName = String(name ?? '').trim()
      if (!assetName) return this.initialAsset ?? {}

      try {
        const data = await this.requestEndpoint('assets_read', 'assets/read', { name: assetName }, 15_000)
        const asset = this.extractAssetFromReadResponse(data)

        return Object.keys(asset ?? {}).length ? asset : (this.initialAsset ?? {})
      } catch (error: any) {
        if (this.isTimeoutError(error)) {
          console.warn('assets_read timed out, using local/default asset state', error)
          return this.initialAsset ?? {}
        }

        throw error
      }
    },

    async open(name = this.name) {
      this.loadingInternal = true
      this.errorMessage = ''

      try {
        await this.ensureBaseData()

        const asset = await this.readAsset(name)
        this.setAsset(asset ?? {})

        await this.loadWledEffectsForAllLamps()
      } catch (error: any) {
        this.errorMessage = this.isTimeoutError(error) ? '' : (error?.message ?? '')
      } finally {
        this.loadingInternal = false
      }
    },

    async ensureBaseData() {
      await Promise.all([
        this.fetchMediaEntries(),
        this.fetchMacros(),
        this.fetchWledConfigs(),
      ])
    },

    async fetchWledConfigs() {
      // WLED integrations are provided by notify_integrations_update / appStore.getIntegrations now.
    },

    async fetchMacros() {
      try {
        const data = await this.requestEndpoint('macro_list', 'macro/list')
        const files = data?.files ?? data?.macros ?? data ?? []
        this.localMacroItems = Array.isArray(files)
          ? files.map((item: any) => String(item?.name ?? item?.path ?? item).replace(/\.ya?ml$/i, '')).filter(Boolean)
          : Object.keys(files ?? {})
      } catch (error) {
        this.localMacroItems = []
      }
    },

    async ensureMediaEntries() {
      if (this.mediaEntries.length) return
      await this.fetchMediaEntries()
    },

    normalizeMediaEntry(entry: any, fallbackPath = ''): MediaEntry | null {
      if (!entry) return null

      if (typeof entry === 'string') {
        const path = this.normalizePath(entry)
        return path ? { name: path.split('/').pop() ?? path, path, type: 'file' } : null
      }

      const rawPath = entry.path ?? entry.file ?? entry.filename ?? entry.name ?? fallbackPath
      const path = this.normalizePath(rawPath)
      if (!path) return null

      const type = entry.type === 'folder' || entry.isDirectory || entry.directory ? 'folder' : 'file'

      return {
        ...entry,
        name: String(entry.name ?? path.split('/').pop() ?? path),
        path,
        type,
      }
    },

    extractMediaEntries(value: any, basePath = ''): MediaEntry[] {
      const result: MediaEntry[] = []

      const add = (entry: any, fallbackPath = '') => {
        const normalized = this.normalizeMediaEntry(entry, fallbackPath)
        if (normalized) result.push(normalized)
      }

      if (Array.isArray(value)) {
        for (const item of value) add(item)
        return result
      }

      if (!value || typeof value !== 'object') return result

      for (const key of ['files', 'items', 'entries', 'children']) {
        if (Array.isArray(value[key])) {
          for (const item of value[key]) add(item)
        }
      }

      for (const [key, item] of Object.entries(value)) {
        if (['files', 'items', 'entries', 'children', 'assets', 'wled'].includes(key)) continue

        const fallbackPath = basePath ? `${basePath}/${key}` : key

        if (typeof item === 'string') {
          add(item)
          continue
        }

        if (!item || typeof item !== 'object') continue

        if ((item as any).type || (item as any).path || (item as any).name || (item as any).asset || (item as any).compressed) {
          add({ ...(item as any), path: (item as any).path ?? fallbackPath })
        }

        if ((item as any).asset) {
          if (typeof (item as any).asset === 'string') add((item as any).asset)
          if (typeof (item as any).asset === 'object') {
            add((item as any).asset.original)
            add((item as any).asset.compressed)
          }
        }

        add((item as any).original)
        add((item as any).compressed)
      }

      return result
    },

    async fetchMediaEntries(path = ''): Promise<MediaEntry[]> {
      try {
        const data = await this.requestEndpoint('media_list', 'assets/media/list', { path }, 15_000)
        const files = data?.files ?? data?.items ?? data?.entries ?? data?.children ?? data ?? []
        const result: MediaEntry[] = []

        for (const rawEntry of this.extractMediaEntries(files)) {
          if (!rawEntry) continue
          result.push(rawEntry)

          if (rawEntry.type === 'folder' && rawEntry.path) {
            result.push(...await this.fetchMediaEntries(rawEntry.path))
          }
        }

        const unique = this.uniqueMediaEntries(result)
        if (!path) this.mediaEntries = unique.filter((entry) => entry?.type === 'file')
        return unique
      } catch (error) {
        if (!path) await this.fetchMediaEntriesFromAssetsList()
        return []
      }
    },

    async fetchMediaEntriesFromAssetsList() {
      try {
        const data = await this.requestEndpoint('assets_list', 'assets/list')
        const result = this.extractMediaEntries(data?.assets ?? data ?? {})
        this.mediaEntries = this.uniqueMediaEntries(result).filter((entry) => entry?.type === 'file')
      } catch (error) {
        this.mediaEntries = []
      }
    },

    uniqueMediaEntries(entries: MediaEntry[]): MediaEntry[] {
      const byPath = new Map<string, MediaEntry>()

      for (const entry of entries) {
        const normalized = this.normalizeMediaEntry(entry)
        if (!normalized?.path) continue
        if (!byPath.has(normalized.path)) byPath.set(normalized.path, normalized)
      }

      return [...byPath.values()]
    },

    setAsset(asset: any = {}) {
      const form = emptyForm()
      form.sound = String(asset?.sound ?? '')
      form.icon = this.normalizeIconName(asset?.icon ?? '')
      form.message = String(asset?.message ?? '')
      form.duration = this.toNullableNumber(asset?.duration)
      form.color = String(asset?.color ?? '').replace(/^#/, '').toUpperCase()
      form.channel = String(asset?.channel ?? '')
      form.volume = this.toNormalizedVolume(asset?.volume)
      form.image = String(asset?.image ?? '')
      form.video = String(asset?.video ?? '')
      form.start_macros = this.toStringArray(asset?.start_macros)
      form.idle_macros = this.toStringArray(asset?.idle_macros)
      form.end_macros = this.toStringArray(asset?.end_macros)
      form.wled = this.toWledControls(asset?.wled)

      this.form = form
      this.wledColorMenus = form.wled.map(() => false)
    },

    toNormalizedVolume(value: any): number | null {
      const normalized = this.toNullableNumber(value)
      if (normalized === null) return null
      return Math.min(1, Math.max(0, normalized))
    },

    normalizeIconName(value: any): string {
      const rawValue = typeof value === 'object' && value !== null
        ? (value.raw ?? value.title ?? value.value ?? '')
        : value

      return String(rawValue ?? '').trim().replace(/^mdi:/, '').replace(/^mdi-/, '')
    },

    iconValue(value: string): string {
      const normalized = this.normalizeIconName(value)
      return normalized ? `mdi-${normalized}` : 'mdi-palette'
    },

    stripWledPrefix(value: any): string {
      const stripped = String(value ?? '')
        .trim()
        .replace(/^wled[\s_-]*/i, '')
        .replace(/^wled(?=[A-Z0-9])/i, '')
        .trim()
      return stripped || String(value ?? '').trim()
    },

    getWledConfigEntries(): Array<Record<string, any>> {
      const integrations = this.appStore?.getIntegrations ?? useAppStore().getIntegrations ?? {}
      const wled = integrations?.wled ?? {}

      return Object.entries(wled).map(([name, value]: [string, any]) => ({
        name: this.stripWledPrefix(name),
        ip: value?.ip ?? value,
      }))
    },

    getWledBaseUrl(lamp: any): string {
      const ip = String(lamp?.ip ?? '').trim()
      if (!ip) return ''

      return (/^https?:\/\//i.test(ip) ? ip : `http://${ip}`).replace(/\/+$/, '')
    },

    getWledLampEntry(name: any): Record<string, any> | undefined {
      const normalizedName = this.stripWledPrefix(name).toLowerCase()
      return this.getWledConfigEntries().find((entry: any) => String(entry.name).toLowerCase() === normalizedName)
    },

    getWledEffectCacheKey(name: any): string {
      return this.stripWledPrefix(name).toLowerCase()
    },

    wledEffectOptions(name: any): Array<{ title: string; value: number }> {
      const key = this.getWledEffectCacheKey(name)
      return key ? this.wledEffectsByLamp[key] ?? [] : []
    },

    async loadWledEffectsForAllLamps() {
      await Promise.all(this.getWledConfigEntries().map((entry: any) => this.loadWledEffects(entry.name)))
    },

    async loadWledEffects(name: any) {
      const lamp = this.getWledLampEntry(name)
      const baseUrl = this.getWledBaseUrl(lamp)
      const cacheKey = this.getWledEffectCacheKey(name)
      const url = baseUrl ? `${baseUrl}/json/eff` : ''

      if (!cacheKey || !url) return

      try {
        const response = await fetch(url, { cache: 'no-store' })
        const effects = await response.json()
        this.wledEffectsByLamp = {
          ...this.wledEffectsByLamp,
          [cacheKey]: Array.isArray(effects)
            ? effects.map((effect: any, index: number) => ({ title: `${index} - ${String(effect)}`, value: index }))
            : [],
        }
      } catch (error) {
        this.wledEffectsByLamp = { ...this.wledEffectsByLamp, [cacheKey]: [] }
      }
    },

    getEntryOriginal(entry: MediaEntry): string {
      if (typeof entry.asset === 'object' && entry.asset?.original) return this.normalizePath(entry.asset.original)
      if (typeof entry.asset === 'string') return this.normalizePath(entry.asset)
      return this.normalizePath(entry.path)
    },

    getEntryCompressed(entry: MediaEntry): string {
      if (typeof entry.compressed === 'string') return this.normalizePath(entry.compressed)
      if (typeof entry.asset === 'object' && typeof entry.asset?.compressed === 'string') return this.normalizePath(entry.asset.compressed)
      return ''
    },

    mediaOptions(regex: RegExp, compressedFirst: boolean): string[] {
      const values: string[] = []
      const add = (value: string) => {
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

      return values
    },

    normalizePath(value: any): string {
      return String(value ?? '').replace(/\\/g, '/').replace(/^\/+/, '').trim()
    },

    toNullableNumber(value: any): number | null {
      if (value === undefined || value === null || value === '') return null
      const numberValue = Number(value)
      return Number.isFinite(numberValue) ? numberValue : null
    },

    toStringArray(value: any): string[] {
      if (!value) return []
      if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean)
      return String(value).split(',').map((item) => item.trim()).filter(Boolean)
    },

    toWledControls(value: any): WledControl[] {
      if (!value || typeof value !== 'object') return []
      return Object.entries(value).map(([name, control]: [string, any]) => ({
        name: this.stripWledPrefix(name),
        red: this.toNullableNumber(control?.red),
        green: this.toNullableNumber(control?.green),
        blue: this.toNullableNumber(control?.blue),
        white: this.toNullableNumber(control?.white),
        effect: this.toNullableNumber(control?.effect),
        brightness: this.toNullableNumber(control?.brightness),
      }))
    },

    openCreateWledDialog(index: number | null = null) {
      this.pendingWledControlIndex = index
      this.$refs.wledIntegrationDialog?.open(index !== null ? this.form.wled?.[index]?.name ?? '' : '')
    },

    handleWledCreated(name: string) {
      if (this.pendingWledControlIndex !== null && this.form.wled?.[this.pendingWledControlIndex]) {
        this.form.wled[this.pendingWledControlIndex].name = name
        void this.loadWledEffects(name)
      }

      this.pendingWledControlIndex = null
    },

    addWledControl() {
      this.form.wled.push({ name: '', red: 255, green: 255, blue: 255, white: 0, brightness: 255, effect: null })
      this.wledColorMenus.push(false)
    },

    removeWledControl(index: number) {
      this.form.wled.splice(index, 1)
      this.wledColorMenus.splice(index, 1)
    },

    cleanString(value: any): string | undefined {
      const normalized = String(value ?? '').trim()
      return normalized ? normalized : undefined
    },

    cleanNumber(value: any): number | undefined {
      if (value === undefined || value === null || value === '') return undefined
      const numberValue = Number(value)
      return Number.isFinite(numberValue) ? numberValue : undefined
    },

    cleanByte(value: any): number | undefined {
      const numberValue = this.cleanNumber(value)
      if (numberValue === undefined) return undefined
      return Math.min(255, Math.max(0, Math.round(numberValue)))
    },

    byteToHex(value: any): string {
      const numberValue = this.cleanByte(value) ?? 0
      return numberValue.toString(16).padStart(2, '0').toUpperCase()
    },

    getWledRgbHex(control: WledControl): string {
      return `#${this.byteToHex(control.red)}${this.byteToHex(control.green)}${this.byteToHex(control.blue)}`
    },

    setWledRgbHex(control: WledControl, value: any) {
      const rawColor = value && typeof value === 'object'
        ? (value.hex ?? value.hexa ?? value.hex8 ?? value.value ?? value.raw?.hex ?? '')
        : value

      const hex = String(rawColor ?? '').replace(/^#/, '').trim()
      const normalizedHex = hex.length === 8 ? hex.slice(0, 6) : hex
      if (!/^[0-9a-f]{6}$/i.test(normalizedHex)) return

      control.red = parseInt(normalizedHex.slice(0, 2), 16)
      control.green = parseInt(normalizedHex.slice(2, 4), 16)
      control.blue = parseInt(normalizedHex.slice(4, 6), 16)
    },

    setWledEffect(control: WledControl, value: any) {
      const rawValue = value && typeof value === 'object' ? (value.value ?? value.raw?.value ?? value.raw ?? value.title) : value
      control.effect = this.toNullableNumber(rawValue)
    },

    importAssetYaml(payload: any) {
      const parsed = payload?.data ?? {}
      const asset = parsed?.content ?? parsed?.asset ?? parsed

      if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
        this.errorMessage = 'invalid asset yaml'
        return
      }

      this.errorMessage = ''
      this.setAsset(asset)
    },

    getAssetPayload() {
      const asset: Record<string, any> = {}

      for (const key of ['sound', 'icon', 'message', 'color', 'channel', 'image', 'video']) {
        let value = this.cleanString((this.form as any)[key])
        if (key === 'icon' && value) value = this.normalizeIconName(value)
        if (key === 'color' && value) value = value.replace(/^#/, '').toUpperCase()
        if (value !== undefined) asset[key] = value
      }

      const duration = this.cleanNumber(this.form.duration)
      if (duration !== undefined) asset.duration = duration

      const volume = this.cleanNumber(this.form.volume)
      if (volume !== undefined) asset.volume = Math.min(1, Math.max(0, volume))

      for (const key of ['start_macros', 'idle_macros', 'end_macros']) {
        const values = this.toStringArray((this.form as any)[key])
        if (values.length) asset[key] = values
      }

      const wled: Record<string, any> = {}
      for (const control of this.form.wled) {
        const name = this.cleanString(control.name)
        if (!name) continue
        const data: Record<string, any> = {}
        for (const key of ['red', 'green', 'blue', 'white', 'brightness', 'effect']) {
          const value = this.cleanByte((control as any)[key])
          if (value !== undefined) data[key] = value
        }
        if (Object.keys(data).length) wled[this.stripWledPrefix(name)] = data
      }
      if (Object.keys(wled).length) asset.wled = wled

      return asset
    },
  },
}
</script>

<style scoped lang="scss">
.asset-color-preview {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.asset-form-section {
  margin-bottom: 20px;
}

.asset-form-section__label {
  margin-bottom: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.72;
}
</style>
