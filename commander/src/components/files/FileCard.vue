<template>
  <v-card
    color="grey-darken-3"
    class="file-card h-100 d-flex flex-column"
    :class="{ 'file-card--folder': entry.type === 'folder' }"
    @click="entry.type === 'folder' ? $emit('open-folder', entry) : undefined"
  >
    <FilePreview
      :entry="entry"
      :rest-api="restApi"
      :public-prefix="publicPrefix"
      :clickable="entry.type === 'file' || entry.type === 'folder'"
      @click.stop="entry.type === 'folder' ? $emit('open-folder', entry) : $emit('preview', entry)"
    />

    <v-card-text class="file-card__content pb-2">
      <div class="text-subtitle-2 text-truncate" :title="entry.name">
        {{ entry.name }}
      </div>

      <div
        v-if="entry.type === 'file'"
        class="text-caption text-grey-lighten-1 text-truncate"
        :title="subtitle"
      >
        {{ subtitle }}
      </div>
    </v-card-text>

    <v-card-actions class="file-card__actions pt-0">
      <v-btn
        v-if="entry.type === 'file'"
        icon="mdi-content-copy"
        size="small"
        variant="text"
        color="primary"
        :disabled="disabled"
        @click.stop="$emit('copy', entry)"
      />

      <v-btn
        v-if="canCompressEntry"
        icon="mdi-archive-arrow-down-outline"
        size="small"
        variant="text"
        color="primary"
        :loading="working && workingAction === 'compress'"
        :disabled="disabled"
        @click.stop="$emit('compress', entry)"
      />

      <v-spacer />

      <v-btn
        icon="mdi-folder-move"
        size="small"
        variant="text"
        :disabled="disabled"
        @click.stop="$emit('move', entry)"
      />

      <v-btn
        icon="mdi-delete"
        size="small"
        variant="text"
        color="red"
        :loading="working && workingAction === 'delete'"
        :disabled="disabled"
        @click.stop="$emit('delete', entry)"
      />
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import FilePreview from '@/components/files/FilePreview.vue'

type FileEntry = {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  asset?: {
    compressed?: string | null
  } | string | null
  compressed?: string | null
}

export default {
  name: 'FileCard',

  components: {
    FilePreview,
  },

  props: {
    entry: {
      type: Object as () => FileEntry,
      required: true,
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
    working: {
      type: Boolean,
      default: false,
    },
    workingAction: {
      type: String,
      default: '',
    },
  },

  emits: [
    'open-folder',
    'preview',
    'copy',
    'compress',
    'move',
    'delete',
  ],

  computed: {
    canCompressEntry(): boolean {
      if (!this.canCompress || this.entry.type !== 'file') return false
      if (/\.svg$/i.test(this.entry.path)) return false

      return /\.(jpe?g|png|webp|gif|mp4|webm|mov|mkv|mp3|flac|wav|ogg|m4a|opus)$/i.test(this.entry.path)
    },

    subtitle(): string {
      const parts = []

      if (this.entry.type === 'folder') {
        parts.push(this.entry.path)
      } else {
        parts.push(this.formatFileSize(this.entry.size))
      }

      if (this.getCompressedPath(this.entry)) {
        parts.push('compressed')
      }

      return parts.filter(Boolean).join(' · ')
    },
  },

  methods: {
    getCompressedPath(entry: FileEntry): string | null {
      if (typeof entry.compressed === 'string') return entry.compressed
      if (typeof entry.asset === 'object' && typeof entry.asset?.compressed === 'string') return entry.asset.compressed

      return null
    },

    formatFileSize(size: any): string {
      const bytes = Number(size)

      if (!Number.isFinite(bytes)) return ''

      const units = ['B', 'KB', 'MB', 'GB']
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
.file-card {
  cursor: default;
  overflow: hidden;
}

.file-card__content {
  flex: 1 1 auto;
}

.file-card__actions {
  margin-top: auto;
  min-height: 44px;
}

.file-card--folder {
  cursor: pointer;
}
</style>
