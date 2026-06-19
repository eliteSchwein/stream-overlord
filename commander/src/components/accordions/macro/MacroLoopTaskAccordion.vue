<template>
  <v-expansion-panel class="macro-loop-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-repeat" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">For: {{ item.task.data?.key || 'item' }}</span>
        <v-spacer />
        <v-chip size="x-small" color="purple" variant="tonal">loop</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-row dense>
        <v-col cols="12" md="4">
          <v-text-field v-model="loopData.key" label="Key" density="comfortable" variant="outlined" hide-details />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model.number="loopData.from" label="From" type="number" density="comfortable" variant="outlined" hide-details />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model.number="loopData.to" label="To" type="number" density="comfortable" variant="outlined" hide-details />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model.number="loopData.step" label="Step" type="number" density="comfortable" variant="outlined" hide-details clearable />
        </v-col>
        <v-col cols="12" md="8">
          <v-text-field v-model="loopData.data" label="Data / variable path" density="comfortable" variant="outlined" hide-details clearable />
        </v-col>
      </v-row>

      <div class="text-caption text-medium-emphasis mt-4 mb-2">Loop tasks</div>
      <component :is="taskListComponent" :items="item.children" :depth="depth + 1" inside-loop nested />

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
export default {
  name: 'MacroLoopTaskAccordion',

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
    taskListComponent: { type: [Object, Function, String], required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    loopData(): any {
      const task = (this.item as any).task
      if (!task.data || typeof task.data !== 'object') task.data = {}
      if (!task.data.key) task.data.key = 'item'
      return task.data
    },
  },
}
</script>
