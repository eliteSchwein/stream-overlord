<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1200"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar
        flat
        density="compact"
      >
        <v-toolbar-title class="d-flex align-center">
          {{ asset?.name || $t('assets.preview') }}
        </v-toolbar-title>

        <v-btn
          icon="mdi-close"
          variant="text"
          @click="$emit('update:modelValue', false)"
        />
      </v-toolbar>

      <v-card-text>
        <div class="asset-preview-dialog__stage">
          <v-img
            v-if="isImage(asset)"
            :src="previewUrl"
            contain
            max-height="70vh"
            class="asset-preview-dialog__image"
          >
            <template #error>
              <div class="asset-preview-dialog__placeholder">
                <v-icon icon="mdi-image-broken" size="72" />
                <div>{{ $t('assets.previewFailed') }}</div>
              </div>
            </template>
          </v-img>

          <video
            v-else-if="isVideo(asset)"
            :src="previewUrl"
            class="asset-preview-dialog__video"
            controls
            autoplay
          />

          <audio
            v-else-if="isAudio(asset)"
            :src="previewUrl"
            class="asset-preview-dialog__audio"
            controls
          />

          <div v-else class="asset-preview-dialog__placeholder">
            <v-icon :icon="getEntryIcon(asset)" size="72" />
            <div>{{ $t('assets.noPreview') }}</div>
          </div>
        </div>

        <v-divider class="my-4" />

        <v-row density="comfortable">
          <v-col cols="12" md="6">
            <v-text-field
              :model-value="normalUrl"
              :label="$t('assets.normalUrl')"
              variant="outlined"
              readonly
              density="comfortable"
              hide-details
            />
          </v-col>

          <v-col v-if="compressedUrl" cols="12" md="6">
            <v-text-field
              :model-value="compressedUrl"
              :label="$t('assets.compressedUrl')"
              variant="outlined"
              readonly
              density="comfortable"
              hide-details
            />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions class="flex-wrap ga-2">
        <v-btn
          v-if="asset?.type === 'file'"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-archive-arrow-down-outline"
          :loading="compressing"
          :disabled="disabled"
          @click="$emit('compress', asset)"
        >
          {{ $t('assets.compress') }}
        </v-btn>

        <v-btn
          variant="tonal"
          prepend-icon="mdi-file-move-outline"
          :disabled="disabled"
          @click="$emit('move', asset)"
        >
          {{ $t('assets.move') }}
        </v-btn>

        <v-btn
          color="red"
          variant="tonal"
          prepend-icon="mdi-delete"
          :loading="deleting"
          :disabled="disabled"
          @click="$emit('delete', asset)"
        >
          {{ $t('assets.delete') }}
        </v-btn>

        <v-spacer />

        <v-btn
          variant="text"
          :href="previewUrl"
          target="_blank"
          prepend-icon="mdi-open-in-new"
        >
          {{ $t('assets.open') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
type AssetEntry = {
  name?: string
  path?: string
  type?: 'file' | 'folder'
  compressed?: string | null
  asset?: {
    compressed?: string | null
  } | string | null
}

export default {
  name: 'assets',

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    asset: {
      type: Object as () => AssetEntry | null,
      default: null,
    },
    restApi: {
      type: String,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    compressing: {
      type: Boolean,
      default: false,
    },
    deleting: {
      type: Boolean,
      default: false,
    },
  },

  emits: [
    'update:modelValue',
    'compress',
    'move',
    'delete',
  ],

  computed: {
    previewUrl(): string {
      if (!this.asset?.path) return ''

      const compressed = this.getCompressedPath(this.asset)
      return this.getAssetUrl(compressed || this.asset.path)
    },

    normalUrl(): string {
      if (!this.asset?.path) return ''
      return this.toPublicPath(this.asset.path)
    },

    compressedUrl(): string {
      const compressed = this.getCompressedPath(this.asset)
      if (!compressed) return ''

      return this.toPublicPath(compressed)
    },
  },

  methods: {
    getCompressedPath(asset: AssetEntry | null): string | null {
      if (!asset) return null
      if (typeof asset.compressed === 'string') return asset.compressed
      if (typeof asset.asset === 'object' && typeof asset.asset?.compressed === 'string') return asset.asset.compressed

      return null
    },

    normalizePath(value: string): string {
      return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')
    },

    toPublicPath(value: string): string {
      const normalized = this.normalizePath(value)
      return normalized ? `/${normalized}` : '/'
    },

    getAssetUrl(path: string): string {
      const normalized = this.normalizePath(path)
      const encoded = normalized
        .split('/')
        .map(part => encodeURIComponent(part))
        .join('/')

      return `${this.restApi}/${encoded}`
    },

    getEntryIcon(asset: AssetEntry | null): string {
      if (asset?.type === 'folder') return 'mdi-folder'
      if (this.isImage(asset)) return 'mdi-image'
      if (this.isVideo(asset)) return 'mdi-video'
      if (this.isAudio(asset)) return 'mdi-music'

      return 'mdi-file'
    },

    isImage(asset: AssetEntry | null): boolean {
      return asset?.type === 'file' && /\.(jpe?g|png|webp|gif|svg)$/i.test(asset.path ?? '')
    },

    isVideo(asset: AssetEntry | null): boolean {
      return asset?.type === 'file' && /\.(mp4|webm|mov|mkv)$/i.test(asset.path ?? '')
    },

    isAudio(asset: AssetEntry | null): boolean {
      return asset?.type === 'file' && /\.(mp3|flac|wav|ogg|m4a|opus)$/i.test(asset.path ?? '')
    },
  },
}
</script>

<style scoped>
.asset-preview-dialog__stage {
  min-height: 320px;
  max-height: 70vh;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  overflow: hidden;
}

.asset-preview-dialog__image,
.asset-preview-dialog__video {
  width: 100%;
  max-height: 70vh;
}

.asset-preview-dialog__video {
  object-fit: contain;
}

.asset-preview-dialog__audio {
  width: min(720px, 100%);
}

.asset-preview-dialog__placeholder {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.65);
}
</style>
