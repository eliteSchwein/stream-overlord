<template>
  <MacroFunctionBaseTaskAccordion
    :item="item"
    :index="index"
    :depth="depth"
    :title-prefix="$t('macro.function.toggleAutoMacro.title')"
    icon="mdi-toggle-switch-outline"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <template #default="{ data }">
      <v-col cols="12" md="7">
        <v-text-field v-model="data.name" :label="$t('macro.function.fields.autoMacroName')" density="compact" variant="outlined" hide-details />
      </v-col>
      <v-col cols="12" md="5">
        <v-switch v-model="data.enabled" :label="$t('common.enabled')" color="primary" density="compact" hide-details inset />
      </v-col>
    </template>
  </MacroFunctionBaseTaskAccordion>
</template>

<script lang="ts">
import MacroFunctionBaseTaskAccordion from './MacroFunctionBaseTaskAccordion.vue'

export default {
  name: 'MacroFunctionToggleAutoMacroTaskAccordion',

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
    task.method = 'toggle_auto_macro'
    if (!task.data || typeof task.data !== 'object') task.data = {}
  },
}
</script>
