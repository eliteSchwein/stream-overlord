<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-music-note"
    :title="$t('macro.music.playSong.title')"
    export-prefix="macro_music_play_song"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-text-field
      v-model="task.data.song"
      :label="$t('macro.music.fields.song')"
      placeholder="${song}"
      variant="outlined"
      density="comfortable"
    />

    <div class="d-flex flex-wrap ga-4">
      <v-switch v-model="task.data.continue" :label="$t('macro.music.fields.continuePlaylist')" color="primary" hide-details />
      <v-switch v-model="task.data.restart" :label="$t('macro.music.fields.restartSong')" color="primary" hide-details />
      <v-switch v-model="task.data.pause" :label="$t('macro.music.fields.loadPaused')" color="primary" hide-details />
    </div>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroMusicPlaySongTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  computed: {
    task(): any { return (this.item as any).task },
  },
  created() {
    this.task.channel = 'music'
    this.task.method = 'play_song'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.song ??= ''
    this.task.data.continue ??= true
    this.task.data.restart ??= true
    this.task.data.pause ??= false
  },
}
</script>
