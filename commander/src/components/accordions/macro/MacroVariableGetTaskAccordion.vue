<template>
  <v-expansion-panel class="macro-variable-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-database-import-outline" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">
          Get variable: {{ variableData.key || 'Select key' }}
        </span>
        <v-spacer />
        <v-chip size="x-small" color="cyan" variant="tonal">variable get</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-combobox
        v-model="variableData.key"
        :items="variableOptions"
        label="Variable key"
        density="comfortable"
        variant="outlined"
        hide-details
        clearable
      />

      <div class="d-flex flex-wrap ga-2 mt-4">
        <v-spacer />
        <v-btn icon="mdi-arrow-up" size="small" variant="text" @click="$emit('move-up')" />
        <v-btn icon="mdi-arrow-down" size="small" variant="text" @click="$emit('move-down')" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="$emit('remove')" />
      </div>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'

export default {
  name: 'MacroVariableGetTaskAccordion',

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
