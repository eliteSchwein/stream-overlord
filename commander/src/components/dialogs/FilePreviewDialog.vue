<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1200"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar flat density="compact">
        <v-toolbar-title class="d-flex align-center">
          {{ entry?.name || title }}
        </v-toolbar-title>

        <v-btn
          icon="mdi-close"
          variant="text"
          @click="$emit('update:modelValue', false)"
        />
      </v-toolbar>

      <v-card-text>
        <FilePreview
          :entry="entry"
          :rest-api="restApi"
          :public-prefix="publicPrefix"
          variant="dialog"
          :controls="true"
          :autoplay="isVideo(entry)"
          :muted="false"
        />

        <v-divider class="my-4" />

        <v-row density="comfortable">
          <v-col cols="12" md="6">
            <v-text-field
              :model-value="normalUrl"
              :label="normalLabel"
              variant="outlined"
              readonly
              density="comfortable"
              hide-details
            />
          </v-col>

          <v-col v-if="compressedUrl" cols="12" md="6">
            <v-text-field
              :model-value="compressedUrl"
              :label="compressedLabel"
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
          v-if="canCompressEntry"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-archive-arrow-down-outline"
          :loading="compressing"
          :disabled="disabled"
          @click="$emit('compress', entry)"
        >
          {{ compressLabel }}
        </v-btn>

        <v-btn
          variant="tonal"
          prepend-icon="mdi-file-move-outline"
          :disabled="disabled"
          @click="$emit('move', entry)"
        >
          {{ moveLabel }}
        </v-btn>

        <v-btn
          color="red"
          variant="tonal"
          prepend-icon="mdi-delete"
          :loading="deleting"
          :disabled="disabled"
          @click="$emit('delete', entry)"
        >
          {{ deleteLabel }}
        </v-btn>

        <v-spacer />

        <v-btn
          variant="text"
          :href="previewUrl"
          target="_blank"
          prepend-icon="mdi-open-in-new"
        >
          {{ openLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import FilePreview from '@/components/files/FilePreview.vue'

type FileEntry = {
  name?: string
  path?: string
  type?: 'file' | 'folder'
  compressed?: string | null
  asset?: {
    compressed?: string | null
  } | string | null
}

export default {
  name: 'FilePreviewDialog',

  components: {
    FilePreview,
  },

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
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
    canCompress: {
      type: Boolean,
      default: false,
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
    title: {
      type: String,
      default: 'Preview',
    },
    normalLabel: {
      type: String,
      default: 'URL',
    },
    compressedLabel: {
      type: String,
      default: 'Compressed URL',
    },
    compressLabel: {
      type: String,
      default: 'Compress',
    },
    moveLabel: {
      type: String,
      default: 'Move',
    },
    deleteLabel: {
      type: String,
      default: 'Delete',
    },
    openLabel: {
      type: String,
      default: 'Open',
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
      if (!this.entry?.path) return ''

      const compressed = this.getCompressedPath(this.entry)
      return this.getPublicUrl(compressed || this.entry.path)
    },

    normalUrl(): string {
      if (!this.entry?.path) return ''
      return this.toPublicPath(this.entry.path)
    },

    compressedUrl(): string {
      const compressed = this.getCompressedPath(this.entry)
      if (!compressed) return ''

      return this.toPublicPath(compressed)
    },

    canCompressEntry(): boolean {
      if (!this.canCompress || !this.entry?.path || this.entry.type !== 'file') return false
      if (/\.svg$/i.test(this.entry.path)) return false

      return /\.(jpe?g|png|webp|gif|mp4|webm|mov|mkv|mp3|flac|wav|ogg|m4a|opus)$/i.test(this.entry.path)
    },
  },

  methods: {
    isVideo(entry: FileEntry | null): boolean {
      return entry?.type === 'file' && /\.(mp4|webm|mov|mkv)$/i.test(entry.path ?? '')
    },

    getCompressedPath(entry: FileEntry | null): string | null {
      if (!entry) return null
      if (typeof entry.compressed === 'string') return this.normalizePath(entry.compressed)
      if (typeof entry.asset === 'object' && typeof entry.asset?.compressed === 'string') {
        return this.normalizePath(entry.asset.compressed)
      }

      return null
    },

    toPublicPath(value: string): string {
      const normalized = this.withPublicPrefix(this.normalizePath(value))
      return normalized ? `/${normalized}` : '/'
    },

    getPublicUrl(value: string): string {
      const normalized = this.withPublicPrefix(this.normalizePath(value))
      const encoded = normalized
        .split('/')
        .filter(Boolean)
        .map(part => encodeURIComponent(part))
        .join('/')

      return `${this.restApi}/${encoded}`
    },

    withPublicPrefix(value: string): string {
      const prefix = this.normalizePath(this.publicPrefix)

      if (!prefix) return value
      if (!value) return prefix
      if (value === prefix || value.startsWith(`${prefix}/`)) return value

      return `${prefix}/${value}`
    },

    normalizePath(value: string): string {
      return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')
    },
  },
}
</script>
