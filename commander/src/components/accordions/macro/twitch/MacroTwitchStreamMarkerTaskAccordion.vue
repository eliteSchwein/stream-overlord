<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-map-marker-plus-outline"
    title="Create stream marker"
    export-prefix="macro_twitch_stream_marker"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-text-field v-model="task.data.description" variant="outlined" label="Description" placeholder="Optional marker description" />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchStreamMarkerTaskAccordion',
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
    this.task.channel = 'twitch'
    this.task.method = 'stream_marker'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.description ??= ''
  },
}
</script>
