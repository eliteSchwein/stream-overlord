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
          label="Key"
          density="comfortable"
          variant="outlined"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-text-field
          v-model.number="loopData.from"
          label="From"
          type="number"
          density="comfortable"
          variant="outlined"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-text-field
          v-model.number="loopData.to"
          label="To"
          type="number"
          density="comfortable"
          variant="outlined"
          hide-details
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-text-field
          v-model.number="loopData.step"
          label="Step"
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
          label="Data / variable path"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
      </v-col>
    </v-row>

    <div class="text-caption text-medium-emphasis mt-4 mb-2">
      Loop tasks
    </div>

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
