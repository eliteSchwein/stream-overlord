<template>
  <MacroTaskAccordionTemplate
    class="macro-loop-task-accordion"
    :item="item"
    :index="index"
    icon="mdi-repeat"
    :title="'For: ' + (loopData.key || 'item')"
    export-prefix="macro_loop"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row density="comfortable">
      <v-col cols="12" md="4">
        <v-text-field
          v-model="loopData.key"
          :label="$t('macro.core.loop.key')"
          density="comfortable"
          variant="outlined"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-text-field
          v-model.number="loopData.from"
          :label="$t('macro.core.loop.from')"
          type="number"
          density="comfortable"
          variant="outlined"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-text-field
          v-model.number="loopData.to"
          :label="$t('macro.core.loop.to')"
          type="number"
          density="comfortable"
          variant="outlined"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-text-field
          v-model.number="loopData.step"
          :label="$t('macro.core.loop.step')"
          type="number"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
      </v-col>

      <v-col cols="12" md="8">
        <v-text-field
          v-model="loopData.data"
          :label="$t('macro.core.loop.dataVariablePath')"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
      </v-col>
    </v-row>

    <div class="text-caption text-medium-emphasis mt-4 mb-2">{{ $t('macro.core.loop.loopTasks') }}</div>

    <component
      :is="taskListComponent"
      :items="item.children"
      :depth="depth + 1"
      inside-loop
      nested
    />
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from './MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroLoopTaskAccordion',

  components: {
    MacroTaskAccordionTemplate,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
    taskListComponent: { type: [Object, Function, String], required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  created() {
    if (!Array.isArray((this.item as any).children)) {
      ;(this.item as any).children = []
    }
  },

  computed: {
    loopData(): any {
      const task = (this.item as any).task

      task.channel = 'loop'
      task.method = 'for'

      if (!task.data || typeof task.data !== 'object') {
        task.data = {}
      }

      if (!task.data.key) {
        task.data.key = 'item'
      }

      return task.data
    },
  },
}
</script>
