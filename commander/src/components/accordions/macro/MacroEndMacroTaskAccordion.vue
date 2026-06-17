<template>
  <v-expansion-panel class="macro-end-macro-task-accordion" color="primary">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-stop-circle-outline" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">End macro</span>
        <v-spacer />
        <v-chip size="x-small" color="warning" variant="tonal">end_macro</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-alert
        type="info"
        color="warning"
        density="comfortable"
        variant="tonal"
        text="Stops the current macro here when this task is reached."
        class="mb-3"
      />

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
  name: 'MacroEndMacroTaskAccordion',

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  created() {
    const task = (this.item as any).task
    task.channel = 'condition'
    task.method = 'end_macro'
    delete task.check
    delete task.data
  },
}
</script>
