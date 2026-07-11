<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-skip-next"
    title="Next song"
    export-prefix="macro_music_next"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      text="Skip to the next playlist entry."
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroMusicNextTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  created() {
    const task = (this.item as any).task
    task.channel = 'music'
    task.method = 'next'
    task.data = task.data && typeof task.data === 'object' ? task.data : {}
  },
}
</script>
