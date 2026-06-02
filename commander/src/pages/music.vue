<!-- MusicPlaylist.vue -->
<template>
  <v-card color="grey-darken-4">
    <v-card-title class="d-flex align-center justify-space-between">
      <span>{{ $t('musicPlaylist.title') }}</span>

      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        @click="fetchFiles(null, 'replace')"
      />
    </v-card-title>

    <v-card-text>
      <v-file-input
        :key="fileInputKey"
        v-model="uploadFiles"
        :label="$t('musicPlaylist.addSongs')"
        accept=".mp3,.flac,.wav,.ogg,.m4a,.opus,audio/*"
        prepend-icon="mdi-music"
        multiple
        variant="outlined"
        :disabled="uploading"
        :loading="uploading"
        @update:model-value="uploadMusicFiles"
      />

      <v-divider class="my-4" />

      <v-text-field
        v-model="searchQuery"
        :label="$t('musicPlaylist.searchSong')"
        prepend-inner-icon="mdi-magnify"
        clearable
        variant="outlined"
        density="comfortable"
        :disabled="loading && files.length === 0"
        :loading="searching"
        hide-details
        class="mb-4"
      />

      <v-alert
        v-if="files.length === 0"
        type="info"
        color="grey-darken-3"
        :text="$t('musicPlaylist.noMusicFound')"
      />

      <v-list
        v-else
        density="compact"
        bg-color="transparent"
        class="music-playlist-list"
      >
        <v-list-item
          v-if="hasPrev"
          key="show-prev"
          class="music-playlist-list__load"
          :disabled="loading"
          @click="fetchPrevFiles"
        >
          <template #prepend>
            <v-icon icon="mdi-chevron-up" />
          </template>

          <v-list-item-title>{{ $t('musicPlaylist.showPrevious') }}</v-list-item-title>
        </v-list-item>

        <v-list-item
          v-for="item in files"
          :key="getFileKey(item)"
          :title="getFileName(item)"
          :subtitle="getFileSubtitle(item)"
        >
          <template #append>
            <div class="d-flex align-center ga-1">
              <v-btn
                icon="mdi-play"
                size="small"
                variant="text"
                color="primary"
                :loading="playingFileKey === getFileKey(item)"
                :disabled="deletingFileKey === getFileKey(item)"
                @click.stop="playFile(item)"
              />

              <v-btn
                icon="mdi-delete"
                size="small"
                variant="text"
                color="red"
                :loading="deletingFileKey === getFileKey(item)"
                :disabled="playingFileKey === getFileKey(item)"
                @click.stop="deleteFile(item)"
              />
            </div>
          </template>
        </v-list-item>

        <v-list-item
          v-if="hasNext"
          key="show-next"
          class="music-playlist-list__load"
          :disabled="loading"
          @click="fetchNextFiles"
        >
          <template #prepend>
            <v-icon icon="mdi-chevron-down" />
          </template>

          <v-list-item-title>{{ $t('musicPlaylist.showNext') }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import eventBus from '@/eventBus'

type MusicPlaylistItem = {
  filename?: string
  path?: string
  file?: string
  current?: boolean
  playing?: boolean
  active?: boolean
  [key: string]: any
}

export default {
  data() {
    return {
      files: [] as MusicPlaylistItem[],
      uploadFiles: [] as File[],
      fileInputKey: 0,
      loading: false,
      uploading: false,
      startIndex: 0,
      activeIndex: -1,
      playlistLength: 0,
      hasPrev: false,
      hasNext: false,
      searchQuery: '',
      searching: false,
      searchTimeout: null as ReturnType<typeof setTimeout> | null,
      playlistRequestSequence: 0,
      playingFileKey: null as string | null,
      deletingFileKey: null as string | null,
    }
  },

  computed: {
    ...mapState(useAppStore, ['getWebsocket']),
  },

  watch: {
    searchQuery() {
      this.queueSearch()
    },
  },

  async mounted() {
    await this.fetchFiles()
  },

  beforeUnmount() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
    }
  },

  methods: {
    async fetchFiles(startIndex: number | null = null, mode: 'replace' | 'append' | 'prepend' = 'replace') {
      if (this.loading && mode !== 'replace') return

      const requestSequence = ++this.playlistRequestSequence
      const normalizedSearch = this.getNormalizedSearchQuery()
      const isSearchRequest = normalizedSearch.length >= 2

      this.loading = true
      this.searching = isSearchRequest

      try {
        const requestStartIndex = startIndex !== null && Number.isFinite(startIndex)
          ? Math.max(0, Math.floor(Number(startIndex)))
          : null

        const data = await this.requestPlaylistViaWebsocket({
          ...(requestStartIndex !== null ? { start_index: requestStartIndex } : {}),
          ...(isSearchRequest ? { search: normalizedSearch } : {}),
        })

        if (requestSequence !== this.playlistRequestSequence) return

        const nextFiles = Array.isArray(data.files) ? data.files : []
        const responseStartIndex = this.parseNumber(data.start_index ?? data.startIndex, requestStartIndex ?? 0)
        const responseEndIndex = this.parseNumber(data.end_index ?? data.endIndex, responseStartIndex + nextFiles.length)

        if (mode === 'append') {
          this.files = this.mergeFiles(this.files, nextFiles)
        } else if (mode === 'prepend') {
          this.files = this.mergeFiles(nextFiles, this.files)
        } else {
          this.files = nextFiles
        }

        this.startIndex = mode === 'prepend'
          ? Math.min(this.startIndex, responseStartIndex)
          : mode === 'replace'
            ? responseStartIndex
            : this.startIndex

        this.activeIndex = this.parseNumber(data.active_index ?? data.activeIndex, -1)
        this.playlistLength = this.parseNumber(data.playlist_length ?? data.playlistLength, this.files.length)

        const loadedEndIndex = mode === 'append'
          ? Math.max(this.startIndex + this.files.length, responseEndIndex)
          : this.startIndex + this.files.length

        this.hasPrev = this.startIndex > 0
        this.hasNext = this.playlistLength > 0 && loadedEndIndex < this.playlistLength
      } catch (error) {
        console.error('loading music playlist via websocket failed', error)
      } finally {
        if (requestSequence === this.playlistRequestSequence) {
          this.loading = false
          this.searching = false
        }
      }
    },

    queueSearch() {
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
      }

      this.searchTimeout = setTimeout(async () => {
        const normalizedSearch = this.getNormalizedSearchQuery()

        if (normalizedSearch.length > 0 && normalizedSearch.length < 2) return

        await this.fetchFiles(0, 'replace')
      }, 250)
    },

    getNormalizedSearchQuery(): string {
      return String(this.searchQuery ?? '').trim()
    },

    requestPlaylistViaWebsocket(params: Record<string, any> = {}): Promise<any> {
      return this.requestMusicWebsocket('music_playlist', params)
    },

    requestMusicWebsocket(method: string, params: Record<string, any> = {}, timeout = 10_000): Promise<any> {
      return new Promise((resolve, reject) => {
        eventBus.$emit('websocket:request', {
          method,
          params,
          timeout,
          resolve,
          reject,
        })
      })
    },

    async fetchPrevFiles() {
      const windowSize = 11
      const nextStartIndex = Math.max(0, this.startIndex - windowSize)

      await this.fetchFiles(nextStartIndex, 'prepend')
    },

    async fetchNextFiles() {
      const nextStartIndex = this.startIndex + this.files.length

      await this.fetchFiles(nextStartIndex, 'append')
    },

    mergeFiles(first: MusicPlaylistItem[], second: MusicPlaylistItem[]) {
      const seen = new Set<string>()
      const merged: MusicPlaylistItem[] = []

      for (const item of [...first, ...second]) {
        const key = this.getFileKey(item)

        if (seen.has(key)) continue

        seen.add(key)
        merged.push(item)
      }

      return merged
    },

    parseNumber(value: any, fallback: number) {
      const parsed = Number(value)

      return Number.isFinite(parsed) ? parsed : fallback
    },

    getFileValue(item: MusicPlaylistItem): string {
      return String(item?.path ?? item?.filename ?? item?.file ?? '')
    },

    getFileName(item: MusicPlaylistItem): string {
      const value = this.getFileValue(item)
      const normalized = value.replace(/\\/g, '/')
      const filename = normalized.split('/').filter(Boolean).pop()

      return filename ?? value
    },

    getFileSubtitle(item: MusicPlaylistItem): string {
      const value = this.getFileValue(item)
      const filename = this.getFileName(item)

      if (!value || value === filename) return ''

      return value
    },

    getFileKey(item: MusicPlaylistItem): string {
      return this.getFileValue(item) || this.getFileName(item)
    },

    isCurrentFile(item: MusicPlaylistItem): boolean {
      return item.current === true || item.playing === true || item.active === true
    },

    async fileToBase64(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = () => {
          const result = String(reader.result ?? '')
          const base64 = result.includes(',') ? result.split(',').pop() ?? '' : result

          resolve(base64)
        }

        reader.onerror = () => reject(reader.error ?? new Error('failed to read file'))
        reader.readAsDataURL(file)
      })
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
        const files = await Promise.all(selectedFiles.map(async file => ({
          filename: file.name,
          name: file.name,
          mime: file.type,
          type: file.type,
          size: file.size,
          base64: await this.fileToBase64(file),
        })))

        await this.requestMusicWebsocket('music_playlist_add', { files }, 60_000)

        this.uploadFiles = []
        this.fileInputKey += 1

        await this.fetchFiles(this.getNormalizedSearchQuery().length >= 2 ? 0 : this.startIndex, 'replace')
      } catch (error) {
        console.error('music playlist upload websocket failed', error)
      } finally {
        this.uploading = false
      }
    },

    async playFile(item: MusicPlaylistItem) {
      const key = this.getFileKey(item)
      if (!key || this.playingFileKey) return

      this.playingFileKey = key

      try {
        await this.requestMusicWebsocket('music_play_song', {
          path: this.getFileValue(item),
          filename: this.getFileName(item),
          continue_playlist: true,
          restart: true,
        })

        await this.fetchFiles(this.getNormalizedSearchQuery().length >= 2 ? 0 : this.startIndex, 'replace')
      } catch (error) {
        console.error('music play song websocket failed', error)
      } finally {
        this.playingFileKey = null
      }
    },

    async deleteFile(item: MusicPlaylistItem) {
      const key = this.getFileKey(item)
      if (!key || this.deletingFileKey) return

      this.deletingFileKey = key

      try {
        await this.requestMusicWebsocket('music_delete', {
          filename: this.getFileName(item),
          path: this.getFileValue(item),
        })

        await this.fetchFiles(this.getNormalizedSearchQuery().length >= 2 ? 0 : this.startIndex, 'replace')
      } catch (error) {
        console.error('music delete websocket failed', error)
      } finally {
        this.deletingFileKey = null
      }
    },
  },
}
</script>

<style scoped>
.music-playlist-list {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.music-playlist-list__load {
  opacity: 0.8;
}
</style>
