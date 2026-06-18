<template>
  <MacroFunctionBaseTaskAccordion
    :item="item"
    :index="index"
    :depth="depth"
    title-prefix="Speak"
    icon="mdi-account-voice"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <template #default="{ data }">
      <v-col cols="12">
        <v-text-field v-model="data.content" label="Text" density="compact" variant="outlined" hide-details />
      </v-col>
      <v-text-field class="d-none" v-model="data.event_uuid" label="Event ID" density="compact" variant="outlined" hide-details />
    </template>
  </MacroFunctionBaseTaskAccordion>
</template>

<script lang="ts">
import MacroFunctionBaseTaskAccordion from './MacroFunctionBaseTaskAccordion.vue'

export default {
  name: 'MacroFunctionSpeakTaskAccordion',

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
    task.method = 'speak'
    if (!task.data || typeof task.data !== 'object') task.data = {}
  },
}
</script>
