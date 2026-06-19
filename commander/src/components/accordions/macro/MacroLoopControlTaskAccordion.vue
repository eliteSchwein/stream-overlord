<template>
  <v-expansion-panel class="macro-loop-control-task-accordion" color="primary">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon :icon="icon" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">{{ title }}</span>
        <v-spacer />
        <v-chip size="x-small" color="purple" variant="tonal">loop</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-alert density="comfortable" variant="tonal" color="warning" class="mb-3">
        {{ description }}
      </v-alert>

      <div class="d-flex flex-wrap ga-2">
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
  name: 'MacroLoopControlTaskAccordion',

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    title(): string {
      return (this.item as any).task?.method === 'continue' ? 'Continue loop' : 'Break loop'
    },
    icon(): string {
      return (this.item as any).task?.method === 'continue' ? 'mdi-skip-next-outline' : 'mdi-stop-circle-outline'
    },
    description(): string {
      return (this.item as any).task?.method === 'continue'
        ? 'Skips the rest of the current loop iteration and continues with the next value.'
        : 'Stops the nearest active loop.'
    },
  },
}
</script>
