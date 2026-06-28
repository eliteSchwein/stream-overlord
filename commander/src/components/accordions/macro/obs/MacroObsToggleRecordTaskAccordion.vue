<template>
  <v-expansion-panel class="macro-obs-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-record-circle-outline" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">{{ title }}</span>
        <v-spacer />
        <v-chip size="x-small" color="primary" variant="tonal">ToggleRecord</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-row density="comfortable">
        <v-col cols="12">
          <v-alert type="info" variant="tonal" density="comfortable" text="This OBS action has no extra options." />
        </v-col>
      </v-row>

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
  name: 'MacroObsToggleRecordTaskAccordion',

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
      return (this.item as any).task
    },

    data(): any {
      return this.task.data
    },

    title(): string {
      return 'Toggle recording'
    },

  },

  created() {
    this.task.channel = 'obs'
    this.task.method = 'ToggleRecord'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}

  },
}
</script>
