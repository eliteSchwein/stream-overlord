<template>
  <MacroTaskAccordionTemplate
    class="macro-obs-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-filter-check"
    title="Enable source filter"
    export-prefix="macro_obs_enable_source_filter"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-autocomplete
          v-model="task.data.sourceName"
          :items="sourceOptions"
          label="Source"
          prepend-inner-icon="mdi-import"
          variant="outlined"
          hide-details="auto"
          clearable
          auto-select-first
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-autocomplete
          v-model="task.data.filterName"
          :items="filterOptions"
          label="Filter name"
          prepend-inner-icon="mdi-filter"
          variant="outlined"
          hide-details="auto"
          clearable
          auto-select-first
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'
import { getFilterNames, getInputNames } from './obsTaskHelpers'

export default {
  name: 'MacroObsEnableSourceFilterTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      appStore: useAppStore(),
    }
  },

  computed: {
    task(): any {
      const task = (this.item as any).task

      task.channel = 'obs'
      task.method = 'SetSourceFilterEnabled'
      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      if (task.data.sourceName === undefined) task.data.sourceName = ''
      if (task.data.filterName === undefined) task.data.filterName = ''

      task.data.filterEnabled = true

      return task
    },

    sourceOptions(): string[] {
      return getInputNames(this.appStore.getObsSceneData, this.appStore.getObsAudioData)
    },

    filterOptions(): string[] {
      return getFilterNames(this.appStore.getObsSceneData, this.task.data.sourceName)
    },
  },

  created() {
    this.task
  },
}
</script>
