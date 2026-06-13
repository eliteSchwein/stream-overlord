<template>
  <v-card
    v-if="storageInfo"
    color="grey-darken-3"
    variant="flat"
    class="storage-card h-100"
  >
    <v-card-text class="pa-3">
      <div class="text-subtitle-2 mb-2">
        {{ $t('system.storage') }}
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

        <div v-if="!hideAssetsUsed && assetUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.assetsUsed') }}</span>
          <span>{{ formatFileSize(assetUsed) }}</span>
        </div>

        <div v-if="!hideOverlayUsed && overlayUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.overlayUsed') }}</span>
          <span>{{ formatFileSize(overlayUsed) }}</span>
        </div>

        <div v-if="!hideMusicUsed && musicUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.musicUsed') }}</span>
          <span>{{ formatFileSize(musicUsed) }}</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import eventBus from '@/eventBus'

export default {
  props: {
    hideAssetsUsed: {
      type: Boolean,
      default: false,
    },
    hideOverlayUsed: {
      type: Boolean,
      default: false,
    },
    hideMusicUsed: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      storageInfo: null as any,
    }
  },

  computed: {
    storageUsedPercent(): number {
      if (!this.storageInfo?.total) return 0
      return Math.min(100, Math.max(0, (this.storageInfo.used / this.storageInfo.total) * 100))
    },

    assetUsed(): number | null {
      if (this.storageInfo?.folders?.assets !== undefined) return this.storageInfo.folders.assets
      if (this.storageInfo?.assetUsed !== undefined) return this.storageInfo.assetUsed
      return null
    },

    overlayUsed(): number | null {
      if (this.storageInfo?.folders?.overlays !== undefined) return this.storageInfo.folders.overlays
      return null
    },

    musicUsed(): number | null {
      if (this.storageInfo?.folders?.music !== undefined) return this.storageInfo.folders.music
      if (this.storageInfo?.musicUsed !== undefined) return this.storageInfo.musicUsed
      return null
    },
  },

  async mounted() {
    eventBus.$on('websocket:connected', async () => {
      await this.fetchStorageInfo()
    })

    await this.fetchStorageInfo()
  },

  methods: {
    requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 10_000): Promise<any> {
      return new Promise((resolve, reject) => {
        eventBus.$emit('websocket:request', {
          method,
          params,
          timeout,
          resolve,
          reject,
        })
      })
    },

    async fetchStorageInfo() {
      try {
        const response = await this.requestWebsocket('system_storage', {})
        this.storageInfo = response?.data ?? response
      } catch (error) {
        console.error('loading storage via websocket failed', error)
      }
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
