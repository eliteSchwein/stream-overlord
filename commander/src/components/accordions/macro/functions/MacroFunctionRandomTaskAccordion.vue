<template>
  <MacroFunctionBaseTaskAccordion
    :item="item"
    :index="index"
    :depth="depth"
    title-prefix="Random number"
    icon="mdi-dice-multiple-outline"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <template #default="{ data }">
      <v-col cols="12" md="3">
        <v-text-field v-model="data.key" label="Variable key" density="compact" variant="outlined" hide-details />
      </v-col>
      <v-col cols="12" md="3">
        <v-text-field v-model.number="data.min" label="Min" type="number" density="compact" variant="outlined" hide-details />
      </v-col>
      <v-col cols="12" md="3">
        <v-text-field v-model.number="data.max" label="Max" type="number" density="compact" variant="outlined" hide-details />
      </v-col>
    </template>
  </MacroFunctionBaseTaskAccordion>
</template>

<script lang="ts">
import MacroFunctionBaseTaskAccordion from './MacroFunctionBaseTaskAccordion.vue'

export default {
  name: 'MacroFunctionRandomTaskAccordion',

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
    task.method = 'random'
    if (!task.data || typeof task.data !== 'object') task.data = {}
  },
}
</script>
