<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-play-pause"
    :title="$t('macro.music.togglePause.title')"
    export-prefix="macro_music_toggle_pause"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      :text="$t('macro.music.togglePause.info')"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroMusicTogglePauseTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  created() {
    const task = (this.item as any).task
    task.channel = 'music'
    task.method = 'toggle_pause'
    task.data = task.data && typeof task.data === 'object' ? task.data : {}
  },
}
</script>
