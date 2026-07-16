<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-skip-previous"
    :title="$t('macro.music.previous.title')"
    export-prefix="macro_music_back"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      :text="$t('macro.music.previous.info')"
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroMusicPreviousTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  created() {
    const task = (this.item as any).task
    task.channel = 'music'
    task.method = 'back'
    task.data = task.data && typeof task.data === 'object' ? task.data : {}
  },
}
</script>
