<template>
  <MacroFunctionBaseTaskAccordion
    :item="item"
    :index="index"
    :depth="depth"
    :title-prefix="$t('macro.function.parallel.title')"
    icon="mdi-call-split"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <template #default>
      <v-col cols="12">
        <v-alert
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
          :text="$t('macro.function.parallel.info')"
        />

        <component
          :is="taskListComponent"
          :items="parallelItems"
          :depth="depth + 1"
          :task-list-component="taskListComponent"
          nested
        />
      </v-col>
    </template>
  </MacroFunctionBaseTaskAccordion>
</template>

<script lang="ts">
import MacroFunctionBaseTaskAccordion from './MacroFunctionBaseTaskAccordion.vue'

export default {
  name: 'MacroFunctionParallelTaskAccordion',

  components: {
    MacroFunctionBaseTaskAccordion,
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
    taskListComponent: { type: [Object, Function, String], required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      parallelItems: [] as any[],
    }
  },

  created() {
    const task = (this.item as any).task
    task.channel = 'function'
    task.method = 'parallel'
    if (!task.data || typeof task.data !== 'object') task.data = {}
    if (!Array.isArray(task.data.tasks)) task.data.tasks = []

    this.parallelItems = task.data.tasks.map((nestedTask: any) => ({
      id: this.uid(),
      type: 'task',
      task: nestedTask,
    }))
  },

  watch: {
    parallelItems: {
      deep: true,
      handler(items: any[]) {
        ;(this.item as any).task.data.tasks = items.map((entry: any) => entry.task)
      },
    },
  },

  methods: {
    uid() {
      return `${Date.now()}_${Math.random().toString(16).slice(2)}`
    },
  },
}
</script>
