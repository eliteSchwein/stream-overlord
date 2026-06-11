<template>
  <v-dialog
    :model-value="modelValue"
    max-width="750"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar
        flat
        density="compact"
      >
        <v-toolbar-title class="d-flex align-center">
          {{ $t('assets.copyDialog') }}
        </v-toolbar-title>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)"></v-btn>
      </v-toolbar>

      <v-card-text>
        <v-text-field
          :model-value="normalUrl"
          :label="$t('assets.normalUrl')"
          variant="outlined"
          readonly
          append-inner-icon="mdi-content-copy"
          @click:append-inner="copyToClipboard(normalUrl)"
        />

        <v-text-field
          v-if="compressedUrl"
          :model-value="compressedUrl"
          :label="$t('assets.compressedUrl')"
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
type AssetEntry = {
  path?: string
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
  },

  emits: ['update:modelValue'],

  computed: {
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
