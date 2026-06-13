<template>
  <v-dialog
    :model-value="modelValue"
    max-width="750"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar flat density="compact">
        <v-toolbar-title class="d-flex align-center">
          {{ title }}
        </v-toolbar-title>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-card-text>
        <v-text-field
          :model-value="normalUrl"
          :label="normalLabel"
          variant="outlined"
          readonly
          append-inner-icon="mdi-content-copy"
          @click:append-inner="copyToClipboard(normalUrl)"
        />

        <v-text-field
          v-if="compressedUrl"
          :model-value="compressedUrl"
          :label="compressedLabel"
          variant="outlined"
          readonly
          append-inner-icon="mdi-content-copy"
          @click:append-inner="copyToClipboard(compressedUrl)"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
type FileEntry = {
  path?: string
  compressed?: string | null
  asset?: {
    compressed?: string | null
  } | string | null
}

export default {
  name: 'FileCopyDialog',

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    entry: {
      type: Object as () => FileEntry | null,
      default: null,
    },
    publicPrefix: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      default: 'Copy URL',
    },
    normalLabel: {
      type: String,
      default: 'URL',
    },
    compressedLabel: {
      type: String,
      default: 'Compressed URL',
    },
  },

  emits: ['update:modelValue'],

  computed: {
    normalUrl(): string {
      if (!this.entry?.path) return ''
      return this.toPublicPath(this.entry.path)
    },

    compressedUrl(): string {
      const compressed = this.getCompressedPath(this.entry)
      if (!compressed) return ''

      return this.toPublicPath(compressed)
    },
  },

  methods: {
    getCompressedPath(entry: FileEntry | null): string | null {
      if (!entry) return null
      if (typeof entry.compressed === 'string') return entry.compressed
      if (typeof entry.asset === 'object' && typeof entry.asset?.compressed === 'string') return entry.asset.compressed

      return null
    },

    toPublicPath(value: string): string {
      const normalized = this.withPublicPrefix(this.normalizePath(value))
      return normalized ? `/${normalized}` : '/'
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

    async copyToClipboard(value: string) {
      if (!value) return

      try {
        await navigator.clipboard.writeText(value)
      } catch (error) {
        console.error('copy failed', error)
      }
    },
  },
}
</script>
