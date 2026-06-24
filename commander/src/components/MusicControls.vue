<template>
  <v-card
    class="music-controls"
    color="grey-darken-3"
    rounded
  >
    <div class="music-controls-content">
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ $t('music.title') }}</span>
        <v-spacer></v-spacer>
        <v-switch
          density="compact"
          :label="$t('music.songRequests')"
          :model-value="music?.songrequest?.enabled ?? false"
          @click="toggleSongRequest"
          hide-details
        />
      </v-card-title>

      <v-card-text>
        <div class="music-controls-main">
          <div class="music-cava-background" aria-hidden="true">
            <div
              v-for="(value, index) in smoothedCavaValues"
              :key="index"
              class="music-cava-bar"
              :style="{ height: getCavaBarHeight(value) }"
            />
          </div>

          <div class="music-controls-main-content">
            <div class="text-subtitle-1 font-weight-bold text-truncate">
              {{ music.title || $t('music.noSong') }}
            </div>

            <div class="text-body-2 text-grey-lighten-1 text-truncate">
              {{ music.artist || $t('music.unknownArtist') }}
            </div>

            <div class="music-control-buttons">
              <v-btn
                icon="mdi-shuffle-variant"
                :color="isShuffleEnabled ? 'primary' : undefined"
                @click="callMusicApi('shuffle')"
              />
              <v-btn icon="mdi-skip-previous" @click="callMusicApi('back')" />
              <v-btn
                :icon="isPlaying ? 'mdi-pause' : 'mdi-play'"
                @click="callMusicApi(isPlaying ? 'pause' : 'play')"
              />
              <v-btn icon="mdi-skip-next" @click="callMusicApi('next')" />
              <v-btn
                icon="mdi-repeat"
                :color="isLoopEnabled ? 'primary' : undefined"
                @click="callMusicApi('loop')"
              />
            </div>

            <div class="music-cava-spacer" aria-hidden="true" />

            <v-progress-linear
              class="music-progress"
              :model-value="music.progress_percentage ?? 0"
              height="8"
              rounded
            />

            <div class="d-flex justify-space-between text-caption mt-1">
              <span>{{ formatTime(music.position) }}</span>
              <span>{{ formatTime(music.duration) }}</span>
            </div>
          </div>
        </div>

        <div class="d-flex align-center justify-space-between mt-4 mb-2">
          <div class="text-caption">
            {{ isSongRequestEnabled ? $t('music.songRequests') : $t('music.playlist') }}: {{ $t('music.songCount', { count: playlistLength }) }}
          </div>
        </div>

        <v-list
          ref="playlistList"
          density="compact"
          bg-color="transparent"
          class="music-playlist-list"
        >
          <v-list-item
            v-for="item in playlist"
            :key="item.id ?? item.filename"
            :title="getFilename(item)"
            :active="isCurrentSong(item)"
            :class="{ 'current-song': isCurrentSong(item) }"
            :ref="el => setPlaylistItemRef(el, item)"
          >
            <template #append>
              <div class="d-flex align-center ga-1">
                <v-btn
                  v-if="!isCurrentSong(item)"
                  icon="mdi-play"
                  size="small"
                  variant="text"
                  color="primary"
                  @click="playSong(item)"
                />

                <v-btn
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="red"
                  @click="deleteSong(item)"
                />
              </div>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </div>
  </v-card>
</template>

<script lang="ts">
import { defineComponent, nextTick } from 'vue'
import { useAppStore } from '@/stores/app'
import eventBus from '@/eventBus'
import {getWebsocketClient} from "@/plugins/websocketInstance.ts";

export default defineComponent({
  name: 'MusicControls',

  data() {
    return {
      playlistItemRefs: {} as Record<string, any>,
      playlistResponse: null as any,
      playlistLoading: false,
      lastPlaylistTrackKey: '',
      cavaBuffer: '',
      expectedCavaBarCount: 0,
      cavaValues: [] as number[],
      smoothedCavaValues: [] as number[],
      cavaSmoothing: 0.45,
      cavaFalloff: 6,
    }
  },

  computed: {
    appStore(): ReturnType<typeof useAppStore> {
      return useAppStore()
    },

    music(): any {
      return this.appStore.getMusicData ?? {}
    },

    getMusicCavaData(): any {
      return this.appStore.getMusicCavaData
    },

    cavaRaw(): string {
      return String(this.getMusicCavaData?.raw ?? '')
    },

    getWebsocket(): string {
      return this.appStore.getWebsocket ?? ''
    },

    isSongRequestEnabled(): boolean {
      return this.music?.songrequest?.enabled === true
    },

    songRequestFiles(): any[] {
      const songrequest = this.music?.songrequest ?? {}
      const candidates = [
        songrequest.files,
        songrequest.playlist,
        songrequest.queue,
        songrequest.requests,
        songrequest.songs,
      ]

      for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate
      }

      return []
    },

    playlist(): any[] {
      if (this.isSongRequestEnabled) return this.songRequestFiles

      return this.playlistResponse?.files ?? []
    },

    playlistLength(): number {
      if (this.isSongRequestEnabled) return this.songRequestFiles.length

      return this.playlistResponse?.playlist_length ?? this.music.playlist_length ?? this.playlist.length
    },

    isPlaying(): boolean {
      return this.music.status === 'playing'
    },

    isShuffleEnabled(): boolean {
      return this.music.shuffle === true
    },

    isLoopEnabled(): boolean {
      return this.music.loop === true || this.music.loop_file === true
    },

    currentTrackKey(): string {
      return [
        this.music?.track?.path ?? '',
        this.music?.track?.filename ?? '',
        this.music?.track?.title ?? '',
        this.music?.filename ?? '',
        this.music?.path ?? '',
        this.music?.title ?? '',
      ].join('|')
    },
  },

  watch: {
    getWebsocket: {
      immediate: true,
      handler(value: string) {
        if (!value) return
        void this.fetchFiles()
      },
    },

    cavaRaw: {
      immediate: true,
      handler(raw: string) {
        if (!raw) return
        this.handleCavaData({ raw })
      },
    },

    currentTrackKey: {
      immediate: true,
      handler() {
        this.refreshPlaylistAfterTrackChange()
      },
    },

    playlist: {
      deep: true,
      handler() {
        void nextTick(() => this.scrollToCurrentSong())
      },
    },

    isSongRequestEnabled() {
      if (!this.isSongRequestEnabled) {
        void this.fetchFiles()
      } else {
        void nextTick(() => this.scrollToCurrentSong())
      }
    },

    songRequestFiles: {
      deep: true,
      handler() {
        if (!this.isSongRequestEnabled) return
        void nextTick(() => this.scrollToCurrentSong())
      },
    },
  },

  mounted() {
    void nextTick(async () => {
      await this.fetchFiles()
      this.refreshPlaylistAfterTrackChange()
      this.scrollToCurrentSong()
    })
  },

  methods: {
    refreshPlaylistAfterTrackChange() {
      if (this.isSongRequestEnabled) {
        void nextTick(() => this.scrollToCurrentSong())
        return
      }

      const key = this.currentTrackKey

      if (!key.replace(/\|/g, '')) {
        void nextTick(() => this.scrollToCurrentSong())
        return
      }

      if (key === this.lastPlaylistTrackKey) {
        void nextTick(() => this.scrollToCurrentSong())
        return
      }

      this.lastPlaylistTrackKey = key
      void this.fetchFiles()
    },

    async fetchFiles() {
      if (this.isSongRequestEnabled) {
        await nextTick()
        this.scrollToCurrentSong()
        return
      }

      if (!this.getWebsocket || this.playlistLoading) return

      this.playlistLoading = true

      try {
        this.playlistResponse = (await getWebsocketClient()?.request('music_playlist'))?.params

        await nextTick()
        this.scrollToCurrentSong()
      } catch (error) {
        console.warn(this.$t('music.playlistWebsocketFailed'), error)
      } finally {
        this.playlistLoading = false
      }
    },

    sendMusicWebsocket(method: string, params: Record<string, any> = {}) {
      void getWebsocketClient()?.send(method, params)
    },

    handleCavaData(data: any) {
      const frames = this.parseCavaFrames(String(data?.raw ?? ''))

      for (const values of frames) {
        if (!values.length) continue

        if (!this.expectedCavaBarCount || values.length !== this.expectedCavaBarCount) {
          this.expectedCavaBarCount = values.length
          this.ensureCavaBars(values.length)
        }

        this.cavaValues = values
        this.smoothCavaValues()
      }
    },

    parseCavaFrames(raw: string): number[][] {
      if (!raw) return []

      this.cavaBuffer += raw

      const lines = this.cavaBuffer.split(/\r?\n/)
      this.cavaBuffer = lines.pop() ?? ''

      return lines
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          const values = line
            .split(/[;,\s]+/)
            .map(value => Number(value))
            .filter(value => Number.isFinite(value))
            .map(value => Math.max(0, Math.min(100, value)))

          return values.length > 1 ? values.slice(0, -1) : values
        })
        .filter(values => values.length > 0)
    },

    ensureCavaBars(count: number) {
      if (this.smoothedCavaValues.length === count) return
      this.smoothedCavaValues = new Array(count).fill(0)
    },

    smoothCavaValues() {
      const smoothed = [...this.smoothedCavaValues]

      for (let i = 0; i < this.cavaValues.length; i++) {
        const target = this.cavaValues[i] ?? 0
        const current = smoothed[i] ?? 0

        if (target > current) {
          smoothed[i] = current + (target - current) * this.cavaSmoothing
        } else {
          smoothed[i] = Math.max(target, current - this.cavaFalloff)
        }
      }

      this.smoothedCavaValues = smoothed
    },

    getCavaBarHeight(value: number): string {
      return value > 0
        ? `${Math.max(3, value)}%`
        : '0%'
    },

    getItemPath(item: any): string {
      return item?.path ?? item?.filename ?? item?.file ?? item?.song?.path ?? item?.song?.filename ?? ''
    },

    getCurrentPath(): string {
      return this.music?.track?.path ?? this.music?.track?.filename ?? this.music?.path ?? this.music?.filename ?? ''
    },

    normalizePath(value: string): string {
      return String(value ?? '').replace(/\\/g, '/').trim()
    },

    getBasename(value: string): string {
      return this.normalizePath(value).split('/').filter(Boolean).pop() ?? this.normalizePath(value)
    },

    isCurrentSong(item: any): boolean {
      const itemPath = this.normalizePath(this.getItemPath(item))
      const currentPath = this.normalizePath(this.getCurrentPath())

      if (!itemPath || !currentPath) return false

      return itemPath === currentPath || this.getBasename(itemPath) === this.getBasename(currentPath)
    },

    setPlaylistItemRef(el: any, item: any) {
      const key = this.getFilename(item)
      if (!key) return

      if (el) {
        this.playlistItemRefs[key] = el
      } else {
        delete this.playlistItemRefs[key]
      }
    },

    scrollToCurrentSong() {
      const current = this.playlist.find(item => this.isCurrentSong(item))
      if (!current) return

      const key = this.getFilename(current)
      const itemRef = this.playlistItemRefs[key]
      const element = itemRef?.$el ?? itemRef

      element?.scrollIntoView?.({
        block: 'center',
        behavior: 'smooth',
      })
    },

    callMusicApi(action: string) {
      if (!this.getWebsocket) return

      this.sendMusicWebsocket(this.getMusicWebsocketMethod(action))
    },

    getMusicWebsocketMethod(action: string): string {
      return `music_${String(action ?? '').replace(/-/g, '_')}`
    },

    formatTime(ms: number = 0): string {
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const rest = seconds % 60

      return `${minutes}:${String(rest).padStart(2, '0')}`
    },

    getFilename(item: any): string {
      if (typeof item === "string") {
        return this.getBasename(item)
      }

      const file = this.getItemPath(item)
      const basename = this.getBasename(file)

      return basename || item?.title || item?.song?.title || String(this.$t('music.unknownSong'))
    },

    async playSong(item: any) {
      if (!this.getWebsocket || this.isCurrentSong(item)) return

      const path = this.getItemPath(item)
      const filename = path || item?.filename || item?.song?.filename

      this.sendMusicWebsocket('music_play_song', {
        ...item,
        filename,
        path,
      })
    },

    async deleteSong(item: any) {
      if (!this.getWebsocket) return

      const filename = this.getFilename(item)

      this.sendMusicWebsocket('music_delete', { filename })
      await this.fetchFiles()
    },

    async toggleSongRequest() {
      if (!this.getWebsocket) return

      this.sendMusicWebsocket('music_songrequest_toggle')
      await this.fetchFiles()
    },

    resetCava() {
      this.cavaBuffer = ''
      this.expectedCavaBarCount = 0
      this.cavaValues = []
      this.smoothedCavaValues = []
    },
  },
})
</script>

<style scoped>
.current-song {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 8px;
}

.music-controls {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.music-controls-main {
  position: relative;
  overflow: hidden;
  margin-left: -16px;
  margin-right: -16px;
  padding-left: 16px;
  padding-right: 16px;
}

.music-cava-background {
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 32px;
  height: 95px;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  opacity: 0.32;
  pointer-events: none;
}

.music-control-buttons {
  position: relative;
  z-index: 3;
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
  margin-bottom: 0;
}

.music-cava-spacer {
  height: 30px;
}

.music-progress {
  position: relative;
  z-index: 4;
  margin-top: 0;
}

.music-cava-bar {
  flex: 1 1 0;
  min-width: 2px;
  max-height: 100%;
  border-radius: 2px 2px 0 0;
  background: currentColor;
  transition: height 80ms linear;
}

.music-controls-main-content,
.music-controls-content {
  position: relative;
}

.music-controls-content {
  z-index: 1;
}

.music-controls-main-content {
  z-index: 2;
}

.music-playlist-list {
  max-height: calc(100vh - 365px);
  overflow-y: auto;
}
</style>
