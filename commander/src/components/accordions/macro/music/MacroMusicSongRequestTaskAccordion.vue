<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-music-note-plus"
    :title="$t('macro.music.songRequest.title')"
    export-prefix="macro_music_song_request"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-text-field
      v-model="task.data.url"
      :label="$t('macro.music.fields.songUrl')"
      :placeholder="$t('macro.music.fields.urlPlaceholder')"
      variant="outlined"
      density="comfortable"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroMusicSongRequestTaskAccordion',
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
    this.task.method = 'song_request'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.url ??= ''
  },
}
</script>
