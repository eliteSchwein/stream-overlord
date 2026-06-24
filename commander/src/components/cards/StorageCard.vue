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
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'

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

  computed: {
    appStore() {
      return useAppStore()
    },

    storageInfo(): any | null {
      return this.normalizeStorageInfo(this.appStore.getStorage)
    },

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

  methods: {
    normalizeStorageInfo(value: any): any | null {
      const raw = value?.content ?? value?.storage ?? value?.info ?? value
      if (!raw || typeof raw !== 'object') return null
      if (!Object.keys(raw).length) return null

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
