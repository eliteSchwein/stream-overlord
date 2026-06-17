<template>
  <MacroFunctionBaseTaskAccordion
    :item="item"
    :index="index"
    :depth="depth"
    title-prefix="Toggle song requests"
    icon="mdi-music-note-off-outline"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <template #default>
      <v-col cols="12" md="8">
        <v-alert type="info" color="grey-darken-3" density="compact" variant="tonal" text="No settings needed. This toggles song requests." />
      </v-col>
    </template>
  </MacroFunctionBaseTaskAccordion>
</template>

<script lang="ts">
import MacroFunctionBaseTaskAccordion from './MacroFunctionBaseTaskAccordion.vue'

export default {
  name: 'MacroFunctionSongRequestToggleTaskAccordion',

  components: {
    MacroFunctionBaseTaskAccordion,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  created() {
    const task = (this.item as any).task
    task.channel = 'function'
    task.method = 'song_request_toggle'
    if (!task.data || typeof task.data !== 'object') task.data = {}
  },
}
</script>
