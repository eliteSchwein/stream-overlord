<template>
  <MacroTaskAccordionTemplate
    class="macro-variable-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-database-export-outline"
    :title="'Set variable: ' + (variableData.key || 'Select key')"
    export-prefix="macro_variable_set"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12">
        <v-combobox
          v-model="variableData.key"
          :items="variableOptions"
          :label="$t('macro.final.variableSet.variableKey')"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
      </v-col>

      <v-col cols="12">
        <v-textarea
          v-model="variableData.value"
          :label="$t('macro.final.variableSet.value')"
          density="comfortable"
          variant="outlined"
          hide-details
          auto-grow
          rows="2"
        />
      </v-col>

      <v-col cols="12">
        <v-switch
          v-model="variableData.to_file"
          :label="$t('macro.final.variableSet.saveToFile')"
          density="comfortable"
          color="primary"
          hide-details
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroVariableSetTaskAccordion',

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
      task.method = 'set'
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
