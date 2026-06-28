<template>
  <MacroTaskAccordionTemplate
    class="macro-variable-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-database-import-outline"
    :title="'Get variable: ' + (variableData.key || 'Select key')"
    export-prefix="macro_variable_get"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-combobox
      v-model="variableData.key"
      :items="variableOptions"
      label="Variable key"
      density="comfortable"
      variant="outlined"
      hide-details
      clearable
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroVariableGetTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      const task = (this.item as any).task

      task.channel = 'variable'
      task.method = 'get'
      task.data ??= {}

      return task
    },

    variableData(): any {
      return this.task.data
    },

    variableOptions(): string[] {
      const variables = useAppStore().getVariables ?? {}

      return Array.isArray(variables)
        ? variables.map(String).sort()
        : Object.keys(variables).sort()
    },
  },
}
</script>
