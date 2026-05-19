<!-- MusicPlaylist.vue -->
<template>
  <v-card color="grey-darken-4">
    <v-card-title class="d-flex align-center justify-space-between">
      <span>Musik Playlist</span>

      <v-btn
        icon="mdi-refresh"
        variant="text"
        @click="fetchFiles"
      />
    </v-card-title>

    <v-card-text>
      <v-file-input
        :key="fileInputKey"
        v-model="uploadFiles"
        label="Lieder hinzufügen (max. 30 auf einmal)"
        accept=".mp3,.flac,.wav,.ogg,.m4a,.opus,audio/*"
        prepend-icon="mdi-music"
        multiple
        variant="outlined"
        :disabled="uploading"
        :loading="uploading"
        @update:model-value="uploadMusicFiles"
      />

      <v-divider class="my-4" />

      <v-alert
        v-if="files.length === 0"
        type="info"
        color="grey-darken-3"
        text="Keine Musik gefunden."
      />

      <v-list
        v-else
        density="compact"
        bg-color="transparent"
        class="music-playlist-list"
      >
        <v-list-item
          v-for="item in files"
          :key="item.filename"
          :title="item.filename"
        >
          <template #append>
            <v-btn
              icon="mdi-delete"
              size="small"
              variant="text"
              color="red"
              @click="deleteFile(item.filename)"
            />
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'

export default {
  data() {
    return {
      files: [] as any[],
      uploadFiles: [] as File[],
      fileInputKey: 0,
      loading: false,
      uploading: false,
    }
  },

  computed: {
    ...mapState(useAppStore, ['getRestApi']),
  },

  async mounted() {
    await this.fetchFiles()
  },

  methods: {
    async fetchFiles() {
      const request = await fetch(`${this.getRestApi}/api/music/playlist`, {
        cache: 'no-store',
      })

      const response = await request.json()

      this.files = response?.data?.files ?? []
    },

    async uploadMusicFiles(value: File | File[] | null) {
      if (this.uploading) return

      const selectedFiles = Array.isArray(value)
        ? value
        : value
          ? [value]
          : []

      if (selectedFiles.length === 0) return

      if (selectedFiles.length > 30) {
        this.uploadFiles = []
        this.fileInputKey += 1
        return
      }

      this.uploading = true

      try {
        const formData = new FormData()

        for (const file of selectedFiles) {
          formData.append('files', file, file.name)
        }

        await fetch(`${this.getRestApi}/api/music/playlist/add`, {
          method: 'POST',
          body: formData,
        })

        this.uploadFiles = []
        this.fileInputKey += 1

        await this.fetchFiles()
      } finally {
        this.uploading = false
      }
    },

    async deleteFile(filename: string) {
      await fetch(`${this.getRestApi}/api/music/playlist/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename }),
      })

      await this.fetchFiles()
    },
  },
}
</script>

<style scoped>
.music-playlist-list {
  max-height: calc(100vh - 240px);
  overflow-y: auto;
}
</style>
