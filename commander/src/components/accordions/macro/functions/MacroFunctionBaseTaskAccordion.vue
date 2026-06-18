<template>
  <v-expansion-panel class="macro-task-accordion macro-function-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon :icon="icon" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">{{ title }}</span>
        <v-spacer />
        <v-chip size="x-small" variant="tonal">function</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-text-field class="d-none" v-model="task.method" label="Function" density="compact" variant="outlined" hide-details />

      <v-row density="comfortable">
        <slot :task="task" :data="data" />
      </v-row>

      <slot name="after" :task="task" :data="data" />

      <div class="d-flex justify-end ga-2 mt-2">
        <v-btn icon="mdi-arrow-up" size="small" variant="text" @click="$emit('move-up')" />
        <v-btn icon="mdi-arrow-down" size="small" variant="text" @click="$emit('move-down')" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="$emit('remove')" />
      </div>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
export default {
  name: 'MacroFunctionBaseTaskAccordion',

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
    titlePrefix: { type: String, default: 'Function' },
    icon: { type: String, default: 'mdi-function' },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      return (this.item as any).task
    },

    data(): any {
      if (!this.task.data || typeof this.task.data !== 'object') {
        this.task.data = {}
      }

      return this.task.data
    },

    title(): string {
      return `${this.titlePrefix}: ${this.task.method || 'method'}`
    },
  },

  created() {
    this.task.channel = 'function'
  },
}
</script>
