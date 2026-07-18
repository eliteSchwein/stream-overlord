<template>
  <MacroTaskAccordionTemplate
    class="macro-file-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-folder-open-outline"
    :title="'Read asset folder: ' + (fileData.path || '/')"
    export-prefix="macro_file_read_folder"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12" md="5">
        <v-combobox
          v-model="fileData.path"
          :items="assetFolderOptions"
          :label="$t('macro.core.file.assetFolderPath')"
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
          :label="$t('macro.core.file.fileExtensionOptional')"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
      </v-col>

      <v-col cols="12" md="3">
        <v-text-field
          v-model="fileData.key"
          :label="$t('macro.core.file.variableKey')"
          density="comfortable"
          variant="outlined"
          hide-details
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroFileTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

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

    task(): any {
      return (this.item as any).task
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
