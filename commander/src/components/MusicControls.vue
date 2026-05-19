<template>
  <v-card
    class="music-controls"
    color="grey-darken-3"
    rounded
  >
    <v-card-title class="d-flex align-center justify-space-between">
      <span>Musik</span>
      <v-spacer></v-spacer>
      <v-switch
        density="compact"
        label="Song Requests"
        :model-value="music?.songrequest?.enabled ?? false"
        @click="toggleSongRequest"
        hide-details
      />
    </v-card-title>

    <v-card-text>
      <div class="text-subtitle-1 font-weight-bold text-truncate">
        {{ music.title || 'Kein song' }}
      </div>

      <div class="text-body-2 text-grey-lighten-1 text-truncate">
        {{ music.artist || 'Unbekannter Künstler' }}
      </div>

      <v-progress-linear
        class="mt-4"
        :model-value="music.progress_percentage ?? 0"
        height="8"
        rounded
      />

      <div class="d-flex justify-space-between text-caption mt-1">
        <span>{{ formatTime(music.position) }}</span>
        <span>{{ formatTime(music.duration) }}</span>
      </div>

      <div class="d-flex justify-center ga-2 mt-4">
        <v-btn icon="mdi-skip-previous" @click="callMusicApi('back')" />
        <v-btn
          :icon="isPlaying ? 'mdi-pause' : 'mdi-play'"
          @click="callMusicApi(isPlaying ? 'pause' : 'play')"
        />
        <v-btn icon="mdi-skip-next" @click="callMusicApi('next')" />
      </div>

      <v-divider class="my-4" />

      <div class="text-caption mb-2">
        Playlist: {{ music.playlist_length ?? 0 }} Songs
      </div>

      <v-list
        ref="playlistList"
        density="compact"
        bg-color="transparent"
        class="music-playlist-list"
        v-if="music?.songrequest?.enabled ?? false"
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
            <v-btn
              icon="mdi-delete"
              size="small"
              variant="text"
              color="red"
              @click="deleteSong(item)"
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
      playlistItemRefs: {} as Record<string, any>,
    }
  },

  watch: {
    'music.track.title'() {
      this.$nextTick(() => this.scrollToCurrentSong())
    },

    'music.track.path'() {
      this.$nextTick(() => this.scrollToCurrentSong())
    },

    'music.track.filename'() {
      this.$nextTick(() => this.scrollToCurrentSong())
    },
  },

  computed: {
    ...mapState(useAppStore, ['getMusicData', 'getRestApi']),

    music(): any {
      return this.getMusicData ?? {}
    },

    playlist(): any[] {
      return this.music.playlist ?? []
    },

    isPlaying(): boolean {
      return this.music.status === 'playing'
    },
  },

  methods: {
    getItemPath(item: any): string {
      return item.filename ?? item.path ?? ''
    },

    getCurrentPath(): string {
      return this.music?.track?.path ?? this.music?.track?.filename ?? ''
    },

    isCurrentSong(item: any): boolean {
      const itemPath = this.getItemPath(item)
      const currentPath = this.getCurrentPath()

      if (!itemPath || !currentPath) return false

      return itemPath === currentPath ||
        this.getFilename(item) === currentPath.split(/[\\/]/).pop()
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
      const ref = this.playlistItemRefs[key]
      const element = ref?.$el ?? ref

      element?.scrollIntoView?.({
        block: 'center',
        behavior: 'smooth',
      })
    },

    async callMusicApi(action: string) {
      await fetch(`${this.getRestApi}/api/music/${action}`, {
        cache: 'no-store',
      })
    },

    formatTime(ms: number = 0): string {
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const rest = seconds % 60

      return `${minutes}:${String(rest).padStart(2, '0')}`
    },

    getFilename(item: any): string {
      const file = item.filename ?? item.path ?? ''

      return file.split(/[\\/]/).pop() ?? file
    },

    async deleteSong(item: any) {
      const filename = this.getFilename(item)

      await fetch(`${this.getRestApi}/api/music/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename }),
      })
    },

    async toggleSongRequest() {
      await fetch(`${this.getRestApi}/api/music/songrequest/toggle`, {
        method: 'POST'
      })
    }
  },
}
</script>

<style scoped>
.current-song {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 8px;
}

.music-controls {
  width: 100%;
}

.music-playlist-list {
   max-height: calc(100vh - 600px);
   overflow-y: auto;
 }
</style>
