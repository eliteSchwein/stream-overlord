<template>
  <div
    class="asset-preview"
    :class="[
      `asset-preview--${variant}`,
      { 'asset-preview--clickable': clickable },
    ]"
  >
    <v-img
      v-if="isImage"
      :src="previewUrl"
      :cover="variant === 'thumbnail'"
      :contain="variant !== 'thumbnail'"
      class="asset-preview__media"
    >
      <template #error>
        <div class="asset-preview__placeholder">
          <v-icon icon="mdi-image-broken" :size="iconSize" />
          <div v-if="showLabel">{{ $t('assets.previewFailed') }}</div>
        </div>
      </template>
    </v-img>

    <video
      v-else-if="isVideo"
      :src="previewUrl"
      class="asset-preview__media asset-preview__video"
      :controls="controls"
      :autoplay="autoplay"
      :muted="muted"
      preload="metadata"
    />

    <audio
      v-else-if="isAudio"
      :src="previewUrl"
      class="asset-preview__audio"
      :controls="controls"
    />

    <div v-else class="asset-preview__placeholder">
      <v-icon :icon="entryIcon" :size="iconSize" />
      <div v-if="showLabel">{{ $t('assets.noPreview') }}</div>
    </div>
  </div>
</template>

<script lang="ts">
type AssetEntry = {
  name?: string
  path?: string
  type?: 'file' | 'folder'
  compressed?: string | null
  asset?: {
    original?: string
    compressed?: string | null
  } | string | null
}

export default {
  name: 'AssetPreview',

  props: {
    asset: {
      type: Object as () => AssetEntry | null,
      default: null,
    },
    restApi: {
      type: String,
      required: true,
    },
    variant: {
      type: String as () => 'thumbnail' | 'dialog' | 'compact',
      default: 'dialog',
    },
    clickable: {
      type: Boolean,
      default: false,
    },
    controls: {
      type: Boolean,
      default: true,
    },
    autoplay: {
      type: Boolean,
      default: false,
    },
    muted: {
      type: Boolean,
      default: false,
    },
    preferCompressed: {
      type: Boolean,
      default: true,
    },
    showLabel: {
      type: Boolean,
      default: true,
    },
  },

  computed: {
    previewUrl(): string {
      if (!this.asset?.path) return ''

      const compressed = this.getCompressedPath(this.asset)
      return this.getAssetUrl(this.preferCompressed && compressed ? compressed : this.asset.path)
    },

    isImage(): boolean {
      return this.asset?.type === 'file' && /\.(jpe?g|png|webp|gif|svg)$/i.test(this.asset.path ?? '')
    },

    isVideo(): boolean {
      return this.asset?.type === 'file' && /\.(mp4|webm|mov|mkv)$/i.test(this.asset.path ?? '')
    },

    isAudio(): boolean {
      return this.asset?.type === 'file' && /\.(mp3|flac|wav|ogg|m4a|opus)$/i.test(this.asset.path ?? '')
    },

    entryIcon(): string {
      if (this.asset?.type === 'folder') return 'mdi-folder'
      if (this.isImage) return 'mdi-image'
      if (this.isVideo) return 'mdi-video'
      if (this.isAudio) return 'mdi-music'

      return 'mdi-file'
    },

    iconSize(): number {
      if (this.variant === 'thumbnail') return 56
      if (this.variant === 'compact') return 48

      return 72
    },
  },

  methods: {
    getCompressedPath(asset: AssetEntry | null): string | null {
      if (!asset) return null
      if (typeof asset.compressed === 'string') return this.normalizePath(asset.compressed)
      if (typeof asset.asset === 'object' && typeof asset.asset?.compressed === 'string') return this.normalizePath(asset.asset.compressed)

      return null
    },

    normalizePath(value: string): string {
      return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')
    },

    getAssetUrl(path: string): string {
      const normalized = this.normalizePath(path)
      const encoded = normalized
        .split('/')
        .map(part => encodeURIComponent(part))
        .join('/')

      return `${this.restApi}/${encoded}`
    },
  },
}
</script>

<style scoped>
.asset-preview {
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.asset-preview--thumbnail {
  width: 100%;
  aspect-ratio: 16 / 9;
}

.asset-preview--dialog {
  min-height: 320px;
  max-height: 70vh;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
}

.asset-preview--compact {
  min-height: 180px;
  max-height: 260px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
}

.asset-preview--clickable {
  cursor: zoom-in;
}

.asset-preview__media {
  width: 100%;
  height: 100%;
  display: block;
}

.asset-preview--dialog .asset-preview__media,
.asset-preview--compact .asset-preview__media {
  max-height: inherit;
}

.asset-preview--thumbnail .asset-preview__media {
  object-fit: cover;
}

.asset-preview__video {
  object-fit: contain;
}

.asset-preview__audio {
  width: min(720px, 100%);
}

.asset-preview__placeholder {
  width: 100%;
  height: 100%;
  min-height: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.65);
}
</style>
