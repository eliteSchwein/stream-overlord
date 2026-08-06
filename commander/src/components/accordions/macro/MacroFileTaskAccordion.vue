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
          :loading="loadingMediaFolders"
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
import { getWebsocketClient } from '@/plugins/websocketInstance'
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
      mediaFolders: [] as string[],
      loadingMediaFolders: false,
      extensionOptions: [
        'webm', 'mp4', 'mov', 'mkv',
        'webp', 'png', 'jpg', 'jpeg', 'gif',
        'svg', 'json', 'lottie',
        'mp3', 'wav', 'ogg', 'flac',
        'txt', 'csv', 'html', 'css', 'js',
      ],
    }
  },

  mounted() {
    void this.fetchMediaFolders()
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
      return [
        ...this.mediaFolders,
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

    async requestMediaList(path = ''): Promise<any[]> {
      const client = getWebsocketClient()

      if (!client) {
        return []
      }

      const response = await client.request('media_list', { path }, 15_000)
      const data = response?.params ?? response?.data ?? response
      return Array.isArray(data?.files) ? data.files : []
    },

    async fetchMediaFolders() {
      if (this.loadingMediaFolders) return

      this.loadingMediaFolders = true

      try {
        const folders = new Set<string>()
        await this.collectMediaFolders('', folders)
        this.mediaFolders = [...folders].sort((a, b) => a.localeCompare(b))
      } catch {
        this.mediaFolders = []
      } finally {
        this.loadingMediaFolders = false
      }
    },

    async collectMediaFolders(path: string, folders: Set<string>) {
      const entries = await this.requestMediaList(path)

      for (const entry of entries) {
        if (entry?.type !== 'folder') continue

        const folderPath = this.normalizePath(entry?.path)
        if (!folderPath || folders.has(folderPath)) continue

        folders.add(folderPath)
        await this.collectMediaFolders(folderPath, folders)
      }
    },
  }
}
</script>
