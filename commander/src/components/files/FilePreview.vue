<template>
  <div
    class="file-preview"
    :class="[`file-preview--${variant}`, { 'file-preview--clickable': clickable }]"
    @click="handleClick"
  >
    <v-img
      v-if="isImage"
      :src="previewUrl"
      cover
      class="file-preview__media"
    >
      <template #error>
        <div class="file-preview__placeholder">
          <v-icon icon="mdi-image-broken" size="48" />
        </div>
      </template>
    </v-img>

    <video
      v-else-if="isVideo"
      class="file-preview__media"
      :src="previewUrl"
      :controls="controls"
      :autoplay="autoplay"
      :muted="muted"
      preload="metadata"
    />

    <audio
      v-else-if="isAudio"
      class="file-preview__audio"
      :src="previewUrl"
      :controls="controls"
      :autoplay="autoplay"
    />

    <iframe
      v-else-if="isHtml && variant === 'dialog'"
      class="file-preview__iframe"
      :src="previewUrl"
    />

    <div v-else class="file-preview__placeholder">
      <v-icon :icon="entryIcon" :size="variant === 'dialog' ? 72 : 56" />
      <div v-if="showLabel" class="text-caption mt-2 text-truncate">
        {{ entry?.name || entry?.path }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
type FileEntry = {
  name?: string
  path?: string
  type?: 'file' | 'folder'
  asset?: {
    compressed?: string | null
  } | string | null
  compressed?: string | null
}

export default {
  name: 'FilePreview',

  props: {
    entry: {
      type: Object as () => FileEntry | null,
      default: null,
    },
    restApi: {
      type: String,
      required: true,
    },
    publicPrefix: {
      type: String,
      default: '',
    },
    variant: {
      type: String,
      default: 'card',
    },
    controls: {
      type: Boolean,
      default: false,
    },
    autoplay: {
      type: Boolean,
      default: false,
    },
    muted: {
      type: Boolean,
      default: true,
    },
    showLabel: {
      type: Boolean,
      default: false,
    },
    clickable: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['click'],

  computed: {
    path(): string {
      return this.normalizePath(this.entry?.path ?? '')
    },

    previewPath(): string {
      return this.getCompressedPath(this.entry) || this.path
    },

    previewUrl(): string {
      return this.getPublicUrl(this.previewPath)
    },

    isImage(): boolean {
      return this.entry?.type === 'file' && /\.(jpe?g|png|webp|gif|svg)$/i.test(this.path)
    },

    isVideo(): boolean {
      return this.entry?.type === 'file' && /\.(mp4|webm|mov|mkv)$/i.test(this.path)
    },

    isAudio(): boolean {
      return this.entry?.type === 'file' && /\.(mp3|flac|wav|ogg|m4a|opus)$/i.test(this.path)
    },

    isHtml(): boolean {
      return this.entry?.type === 'file' && /\.(html?|xhtml)$/i.test(this.path)
    },

    entryIcon(): string {
      if (this.entry?.type === 'folder') return 'mdi-folder'
      if (this.isHtml) return 'mdi-language-html5'
      if (/\.css$/i.test(this.path)) return 'mdi-language-css3'
      if (/\.(js|ts|mjs|cjs)$/i.test(this.path)) return 'mdi-language-javascript'
      if (/\.(json|yaml|yml|toml)$/i.test(this.path)) return 'mdi-code-json'
      if (/\.(txt|md|log)$/i.test(this.path)) return 'mdi-file-document-outline'
      return 'mdi-file'
    },
  },

  methods: {
    handleClick(event: MouseEvent) {
      this.$emit('click', event)
    },

    getCompressedPath(entry: FileEntry | null): string | null {
      if (!entry) return null
      if (typeof entry.compressed === 'string') return this.normalizePath(entry.compressed)
      if (typeof entry.asset === 'object' && typeof entry.asset?.compressed === 'string') {
        return this.normalizePath(entry.asset.compressed)
      }

      return null
    },

    getPublicUrl(value: string): string {
      const normalized = this.normalizePath(value)
      const prefixed = this.withPublicPrefix(normalized)
      const encoded = prefixed
        .split('/')
        .filter(Boolean)
        .map(part => encodeURIComponent(part))
        .join('/')

      return `${this.restApi}/${encoded}`
    },

    withPublicPrefix(value: string): string {
      const normalized = this.normalizePath(value)
      const prefix = this.normalizePath(this.publicPrefix)

      if (!prefix) return normalized
      if (!normalized) return prefix
      if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return normalized

      return `${prefix}/${normalized}`
    },

    normalizePath(value: any): string {
      return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')
    },
  },
}
</script>

<style scoped>
.file-preview {
  aspect-ratio: 16 / 9;
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.file-preview--dialog {
  min-height: 520px;
  aspect-ratio: auto;
}

.file-preview--compact {
  min-height: 180px;
}

.file-preview--clickable {
  cursor: zoom-in;
}

.file-preview__media,
.file-preview__iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

.file-preview__media {
  object-fit: cover;
}

.file-preview--dialog .file-preview__media {
  object-fit: contain;
}

.file-preview__audio {
  width: calc(100% - 32px);
}

.file-preview__placeholder {
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}
</style>
