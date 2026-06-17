<template>
  <MacroTaskAccordion
    :item="item"
    :index="index"
    :depth="depth"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  />
</template>

<script lang="ts">
import MacroTaskAccordion from './MacroTaskAccordion.vue'

export default {
  name: 'MacroWebsocketTaskAccordion',

  components: {
    MacroTaskAccordion,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],
}
</script>
