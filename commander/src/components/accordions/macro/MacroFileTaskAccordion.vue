<template>
  <v-expansion-panel class="macro-file-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-folder-open-outline" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">Read asset folder: {{ fileData.path || '/' }}</span>
        <v-spacer />
        <v-chip size="x-small" color="blue" variant="tonal">file</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-row>
        <v-col cols="12" md="5">
          <v-combobox
            v-model="fileData.path"
            :items="assetFolderOptions"
            label="Asset folder path"
            density="comfortable"
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>

        <v-col cols="12" md="4">
          <v-combobox
            v-model="fileData.fileExtension"
            :items="extensionOptions"
            label="File extension (optional)"
            density="comfortable"
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>

        <v-col cols="12" md="3">
          <v-text-field
            v-model="fileData.key"
            label="Variable key"
            density="comfortable"
            variant="outlined"
            hide-details
          />
        </v-col>
      </v-row>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'

export default {
  name: 'MacroFileTaskAccordion',

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  data() {
    return {
      extensionOptions: [
        'webm', 'mp4', 'mov', 'mkv',
        'webp', 'png', 'jpg', 'jpeg', 'gif',
        'svg', 'json', 'lottie',
        'mp3', 'wav', 'ogg', 'flac',
        'txt', 'csv', 'html', 'css', 'js',
      ],
    }
  },

  computed: {
    fileData(): any {
      const task = (this.item as any).task
      task.channel = 'file'
      task.method = 'read_folder'
      task.data ??= {}
      task.data.key ??= 'files'
      return task.data
    },

    assetFolderOptions(): string[] {
      const appStore = useAppStore()
      const assets = Array.isArray(appStore.getAssets) ? appStore.getAssets : []

      const folders = new Set<string>([''])

      for (const entry of assets) {
        if (typeof entry === 'string') {
          const path = this.normalizePath(entry)

          if (path && !this.hasExtension(path)) {
            folders.add(path)
          }

          this.addParents(folders, path)
          continue
        }

        if (!entry || typeof entry !== 'object') continue

        const original = this.normalizePath((entry as any).original)
        const compressed = this.normalizePath((entry as any).compressed)

        this.addParents(folders, original)
        this.addParents(folders, compressed)
      }

      const foundFolders = [...folders]

      for (const folder of foundFolders) {
        if (!folder || folder === 'compressed' || folder.startsWith('compressed/')) {
          continue
        }

        folders.add(`compressed/${folder}`)
      }

      const sortedFolders = [...folders].filter(Boolean)

      const compressedFolders = sortedFolders
        .filter(folder => folder === 'compressed' || folder.startsWith('compressed/'))
        .sort((a, b) => a.localeCompare(b))

      const normalFolders = sortedFolders
        .filter(folder => folder !== 'compressed' && !folder.startsWith('compressed/'))
        .sort((a, b) => a.localeCompare(b))

      return [
        ...compressedFolders,
        ...normalFolders,
        '',
      ]
    },
  },

  methods: {
    normalizePath(value: any): string {
      return typeof value === 'string'
        ? value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').trim()
        : ''
    },

    hasExtension(value: string): boolean {
      return /\.[a-z0-9]+$/i.test(value)
    },

    addParents(folders: Set<string>, value: string) {
      let current = this.normalizePath(value)

      while (current.includes('/')) {
        current = current.split('/').slice(0, -1).join('/')

        if (current) {
          folders.add(current)
        }
      }
    },
  },
}
</script>
