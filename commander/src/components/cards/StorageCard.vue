<template>
  <v-card
    v-if="storageInfo"
    color="grey-darken-3"
    variant="flat"
    class="storage-card h-100"
  >
    <v-card-text class="pa-3">
      <div class="text-subtitle-2 mb-2 d-flex align-center justify-space-between ga-2">
        <span>{{ $t('system.storage') }}</span>

        <v-progress-circular
          v-if="loading"
          indeterminate
          size="16"
          width="2"
        />
      </div>

      <v-progress-linear
        :model-value="storageUsedPercent"
        height="7"
        rounded
        class="mb-2"
      />

      <div class="storage-card__info">
        <div>
          <span class="text-caption text-grey-lighten-1">{{ $t('system.storageUsed') }}</span>
          <span>{{ formatFileSize(storageInfo.used) }}</span>
        </div>

        <div>
          <span class="text-caption text-grey-lighten-1">{{ $t('system.storageFree') }}</span>
          <span>{{ formatFileSize(storageInfo.free) }}</span>
        </div>

        <div>
          <span class="text-caption text-grey-lighten-1">{{ $t('system.storageTotal') }}</span>
          <span>{{ formatFileSize(storageInfo.total) }}</span>
        </div>

        <div v-if="!hideMediaUsed && mediaUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.mediaUsed') }}</span>
          <span>{{ formatFileSize(mediaUsed) }}</span>
        </div>

        <div v-if="!hideOverlayUsed && overlayUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.overlayUsed') }}</span>
          <span>{{ formatFileSize(overlayUsed) }}</span>
        </div>

        <div v-if="!hideMusicUsed && musicUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.musicUsed') }}</span>
          <span>{{ formatFileSize(musicUsed) }}</span>
        </div>

        <div v-if="!hideMacroUsed && macroUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.macroUsed') }}</span>
          <span>{{ formatFileSize(macroUsed) }}</span>
        </div>

        <div v-if="!hideChannelPointUsed && channelPointUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.channelPointUsed') || 'Channel points' }}</span>
          <span>{{ formatFileSize(channelPointUsed) }}</span>
        </div>
      </div>

      <div
        v-if="error"
        class="text-caption text-error mt-2"
      >
        {{ error }}
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import eventBus from '@/eventBus'

type WebsocketPayload = Record<string, any>

export default {
  props: {
    hideMediaUsed: {
      type: Boolean,
      default: true,
    },
    hideOverlayUsed: {
      type: Boolean,
      default: true,
    },
    hideMusicUsed: {
      type: Boolean,
      default: true,
    },
    hideMacroUsed: {
      type: Boolean,
      default: true,
    },
    hideChannelPointUsed: {
      type: Boolean,
      default: true,
    },
  },

  data() {
    return {
      storageInfo: null as any,
      loading: false,
      error: '',
      refreshTimer: null as ReturnType<typeof setTimeout> | null,
    }
  },

  computed: {
    storageUsedPercent(): number {
      if (!this.storageInfo?.total) return 0
      return Math.min(100, Math.max(0, (Number(this.storageInfo.used ?? 0) / Number(this.storageInfo.total)) * 100))
    },

    mediaUsed(): number | null {
      return this.firstNumber([
        this.storageInfo?.folders?.media,
        this.storageInfo?.folders?.assets,
        this.storageInfo?.mediaUsed,
        this.storageInfo?.assetUsed,
        this.storageInfo?.assetsUsed,
      ])
    },

    overlayUsed(): number | null {
      return this.firstNumber([
        this.storageInfo?.folders?.overlays,
        this.storageInfo?.folders?.overlay,
        this.storageInfo?.overlayUsed,
        this.storageInfo?.overlaysUsed,
      ])
    },

    musicUsed(): number | null {
      return this.firstNumber([
        this.storageInfo?.folders?.music,
        this.storageInfo?.musicUsed,
      ])
    },

    macroUsed(): number | null {
      return this.firstNumber([
        this.storageInfo?.folders?.macros,
        this.storageInfo?.folders?.macro,
        this.storageInfo?.macroUsed,
        this.storageInfo?.macrosUsed,
      ])
    },

    channelPointUsed(): number | null {
      return this.firstNumber([
        this.storageInfo?.folders?.channel_points,
        this.storageInfo?.folders?.channelPoints,
        this.storageInfo?.folders?.channel_points_configs,
        this.storageInfo?.channelPointUsed,
        this.storageInfo?.channelPointsUsed,
      ])
    },
  },

  async mounted() {
    eventBus.$on('websocket:connected', this.handleWebsocketConnected)
    eventBus.$on('storage:refresh', this.scheduleFetchStorageInfo)
    eventBus.$on('assets:changed', this.scheduleFetchStorageInfo)
    eventBus.$on('media:changed', this.scheduleFetchStorageInfo)
    eventBus.$on('music:changed', this.scheduleFetchStorageInfo)
    eventBus.$on('macros:changed', this.scheduleFetchStorageInfo)
    eventBus.$on('channel-points:changed', this.scheduleFetchStorageInfo)
    eventBus.$on('events:changed', this.scheduleFetchStorageInfo)

    await this.fetchStorageInfo()
  },

  beforeUnmount() {
    this.cleanup()
  },

  beforeDestroy() {
    this.cleanup()
  },

  methods: {
    cleanup() {
      eventBus.$off?.('websocket:connected', this.handleWebsocketConnected)
      eventBus.$off?.('storage:refresh', this.scheduleFetchStorageInfo)
      eventBus.$off?.('assets:changed', this.scheduleFetchStorageInfo)
      eventBus.$off?.('media:changed', this.scheduleFetchStorageInfo)
      eventBus.$off?.('music:changed', this.scheduleFetchStorageInfo)
      eventBus.$off?.('macros:changed', this.scheduleFetchStorageInfo)
      eventBus.$off?.('channel-points:changed', this.scheduleFetchStorageInfo)
      eventBus.$off?.('events:changed', this.scheduleFetchStorageInfo)

      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer)
        this.refreshTimer = null
      }
    },

    async handleWebsocketConnected() {
      await this.fetchStorageInfo()
    },

    scheduleFetchStorageInfo() {
      if (this.refreshTimer) clearTimeout(this.refreshTimer)

      this.refreshTimer = setTimeout(async () => {
        this.refreshTimer = null
        await this.fetchStorageInfo()
      }, 150)
    },

    requestWebsocket(method: string, params: WebsocketPayload = {}, timeout = 15_000): Promise<any> {
      return new Promise((resolve, reject) => {
        let settled = false

        const timer = setTimeout(() => {
          if (settled) return
          settled = true
          reject(new Error(`${method} timed out`))
        }, timeout)

        eventBus.$emit('websocket:request', {
          method,
          params,
          timeout,
          resolve: (response: any) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(response)
          },
          reject: (error: any) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            reject(error)
          },
        })
      })
    },

    unwrapWebsocketResponse(response: any, method: string): any {
      const resultKey = `result_${method}`

      const candidates = [
        response?.[resultKey],
        response?.data?.[resultKey],
        response?.payload?.[resultKey],
        response?.result?.[resultKey],
        response?.result,
        response?.data?.result,
        response?.payload?.result,
        response?.data,
        response?.payload,
        response,
      ]

      for (const candidate of candidates) {
        if (candidate !== undefined && candidate !== null) return candidate
      }

      return null
    },

    normalizeStorageInfo(value: any): any {
      const raw = value?.content ?? value?.storage ?? value?.info ?? value
      if (!raw || typeof raw !== 'object') return null

      const used = this.firstNumber([
        raw.used,
        raw.storageUsed,
        raw.usedBytes,
        raw.disk?.used,
        raw.root?.used,
      ])

      const free = this.firstNumber([
        raw.free,
        raw.storageFree,
        raw.freeBytes,
        raw.available,
        raw.disk?.free,
        raw.root?.free,
      ])

      const total = this.firstNumber([
        raw.total,
        raw.storageTotal,
        raw.totalBytes,
        raw.disk?.total,
        raw.root?.total,
      ])

      return {
        ...raw,
        used: used ?? raw.used ?? 0,
        free: free ?? raw.free ?? 0,
        total: total ?? raw.total ?? 0,
        folders: raw.folders ?? raw.directories ?? raw.paths ?? {},
      }
    },

    async fetchStorageInfo() {
      if (this.loading) return

      this.loading = true
      this.error = ''

      try {
        const response = await this.requestWebsocket('system_storage', {})
        const unwrapped = this.unwrapWebsocketResponse(response, 'system_storage')
        const storageInfo = this.normalizeStorageInfo(unwrapped)

        if (!storageInfo) {
          throw new Error('invalid storage response')
        }

        this.storageInfo = storageInfo
      } catch (error: any) {
        console.error('loading storage via websocket failed', error)
        this.error = error?.message ?? 'loading storage failed'
      } finally {
        this.loading = false
      }
    },

    firstNumber(values: any[]): number | null {
      for (const value of values) {
        if (value === undefined || value === null || value === '') continue

        const numberValue = Number(value)
        if (Number.isFinite(numberValue)) return numberValue
      }

      return null
    },

    formatFileSize(size: any): string {
      const bytes = Number(size)
      if (!Number.isFinite(bytes)) return ''

      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let value = bytes
      let unitIndex = 0

      while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024
        unitIndex += 1
      }

      return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
    },
  },
}
</script>

<style scoped>
.storage-card {
  min-height: 116px;
}

.storage-card__info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 18px;
}

.storage-card__info > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.storage-card__info span:last-child {
  white-space: nowrap;
}

@media (max-width: 960px) {
  .storage-card {
    min-height: auto;
  }
}
</style>
