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

      <div class="storage-card__progress mb-2">
        <v-progress-linear
          :model-value="storageUsedPercent"
          height="7"
          rounded
        />

        <template v-if="showSegmentedBar">
          <div
            v-for="segment in visibleStorageSegments"
            :key="segment.key"
            class="storage-card__usage-marker"
            :class="segment.colorClass"
            :style="{
              left: `${segment.leftPercent}%`,
              width: `${segment.widthPercent}%`,
            }"
            :title="`${segment.label}: ${formatFileSize(segment.value)}`"
          />
        </template>

        <div
          v-else-if="visibleStorageUsage > 0"
          class="storage-card__usage-marker bg-primary"
          :style="{ width: `${visibleStorageUsagePercent}%` }"
        />
      </div>

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

        <div v-if="!hideAssetConfigUsed && assetConfigUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.assetConfigUsed') }}</span>
          <span>{{ formatFileSize(assetConfigUsed) }}</span>
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

        <div v-if="!hideAutoMacroUsed && autoMacroUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.autoMacroUsed') }}</span>
          <span>{{ formatFileSize(autoMacroUsed) }}</span>
        </div>

        <div v-if="!hideChannelPointUsed && channelPointUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.channelPointUsed') }}</span>
          <span>{{ formatFileSize(channelPointUsed) }}</span>
        </div>

        <div v-if="!hideCommandUsed && commandUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.commandUsed') }}</span>
          <span>{{ formatFileSize(commandUsed) }}</span>
        </div>

        <div v-if="!hideRotatingSceneUsed && rotatingSceneUsed !== null">
          <span class="text-caption text-grey-lighten-1">{{ $t('system.rotatingSceneUsed') }}</span>
          <span>{{ formatFileSize(rotatingSceneUsed) }}</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'

export default {
  props: {
    showSegmentedBar: {
      type: Boolean,
      default: false,
    },
    hideMediaUsed: {
      type: Boolean,
      default: true,
    },
    hideAssetConfigUsed: {
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
    hideAutoMacroUsed: {
      type: Boolean,
      default: true,
    },
    hideChannelPointUsed: {
      type: Boolean,
      default: true,
    },
    hideCommandUsed: {
      type: Boolean,
      default: true,
    },
    hideRotatingSceneUsed: {
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

    visibleStorageUsage(): number {
      const values = [
        !this.hideMediaUsed ? this.mediaUsed : null,
        !this.hideAssetConfigUsed ? this.assetConfigUsed : null,
        !this.hideOverlayUsed ? this.overlayUsed : null,
        !this.hideMusicUsed ? this.musicUsed : null,
        !this.hideMacroUsed ? this.macroUsed : null,
        !this.hideAutoMacroUsed ? this.autoMacroUsed : null,
        !this.hideChannelPointUsed ? this.channelPointUsed : null,
        !this.hideCommandUsed ? this.commandUsed : null,
        !this.hideRotatingSceneUsed ? this.rotatingSceneUsed : null,
      ]

      return values.reduce((total, value) => {
        const numberValue = Number(value)
        return Number.isFinite(numberValue) ? total + numberValue : total
      }, 0)
    },

    visibleStorageUsagePercent(): number {
      const total = Number(this.storageInfo?.total ?? 0)
      if (!Number.isFinite(total) || total <= 0) return 0

      return Math.min(100, Math.max(0, (this.visibleStorageUsage / total) * 100))
    },

    visibleStorageSegments(): Array<{
      key: string
      label: string
      value: number
      widthPercent: number
      leftPercent: number
      colorClass: string
    }> {
      const total = Number(this.storageInfo?.total ?? 0)
      if (!Number.isFinite(total) || total <= 0) return []

      const candidates = [
        { key: 'media', label: this.$t('system.mediaUsed'), value: this.mediaUsed, colorClass: 'bg-primary' },
        { key: 'asset-config', label: this.$t('system.assetConfigUsed'), value: this.assetConfigUsed, colorClass: 'bg-secondary' },
        { key: 'overlay', label: this.$t('system.overlayUsed'), value: this.overlayUsed, colorClass: 'bg-info' },
        { key: 'music', label: this.$t('system.musicUsed'), value: this.musicUsed, colorClass: 'bg-success' },
        { key: 'macro', label: this.$t('system.macroUsed'), value: this.macroUsed, colorClass: 'bg-warning' },
        { key: 'auto-macro', label: this.$t('system.autoMacroUsed'), value: this.autoMacroUsed, colorClass: 'bg-deep-purple' },
        { key: 'channel-point', label: this.$t('system.channelPointUsed'), value: this.channelPointUsed, colorClass: 'bg-pink' },
        { key: 'command', label: this.$t('system.commandUsed'), value: this.commandUsed, colorClass: 'bg-cyan' },
        { key: 'rotating-scene', label: this.$t('system.rotatingSceneUsed'), value: this.rotatingSceneUsed, colorClass: 'bg-orange' },
      ]

      let leftPercent = 0

      return candidates.flatMap((candidate) => {
        const value = Number(candidate.value)
        if (!Number.isFinite(value) || value <= 0) return []

        const widthPercent = Math.min(100 - leftPercent, Math.max((value / total) * 100, 0))
        if (widthPercent <= 0) return []

        const segment = {
          key: candidate.key,
          label: String(candidate.label),
          value,
          widthPercent,
          leftPercent,
          colorClass: candidate.colorClass,
        }

        leftPercent += widthPercent

        return [segment]
      })
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

    assetConfigUsed(): number | null {
      return this.firstNumber([
        this.storageInfo?.folders?.asset_configs,
        this.storageInfo?.folders?.assetConfigs,
        this.storageInfo?.assetConfigUsed,
        this.storageInfo?.assetConfigsUsed,
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

    autoMacroUsed(): number | null {
      return this.firstNumber([
        this.storageInfo?.folders?.auto_macros,
        this.storageInfo?.folders?.autoMacros,
        this.storageInfo?.folders?.auto_macro,
        this.storageInfo?.autoMacroUsed,
        this.storageInfo?.autoMacrosUsed,
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

    commandUsed(): number | null {
      return this.firstNumber([
        this.storageInfo?.folders?.commands,
        this.storageInfo?.folders?.commands_configs,
        this.storageInfo?.commands,
        this.storageInfo?.commandUsed,
        this.storageInfo?.commandsUsed,
      ])
    },

    rotatingSceneUsed(): number | null {
      return this.firstNumber([
        this.storageInfo?.folders?.rotating_scenes,
        this.storageInfo?.folders?.rotatingScenes,
        this.storageInfo?.folders?.rotating_scene,
        this.storageInfo?.rotatingSceneUsed,
        this.storageInfo?.rotatingScenesUsed,
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

.storage-card__progress {
  position: relative;
  overflow: hidden;
  border-radius: 999px;
}

.storage-card__usage-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  min-width: 2px;
  pointer-events: auto;
}

.storage-card__usage-marker:first-child {
  border-radius: 999px 0 0 999px;
}

.storage-card__usage-marker:last-child {
  border-radius: 0 999px 999px 0;
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
