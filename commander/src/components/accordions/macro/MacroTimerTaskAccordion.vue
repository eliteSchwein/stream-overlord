<template>
  <v-expansion-panel class="macro-timer-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon icon="mdi-timer-play-outline" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">Timer</span>
        <v-spacer />
        <v-chip size="x-small" color="primary" variant="tonal">start</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-row density="comfortable">
        <v-col cols="12" md="4">
          <v-text-field
            v-model="task.data.name"
            label="Timer name"
            prepend-inner-icon="mdi-timer-outline"
            variant="outlined"
            hide-details="auto"
          />
        </v-col>

        <v-col cols="12" md="4">
          <v-number-input
            v-model="task.data.time"
            label="Time"
            suffix="seconds"
            :min="1"
            :step="1"
            prepend-inner-icon="mdi-timer-outline"
            variant="outlined"
            hide-details="auto"
          />
        </v-col>

        <v-col cols="12" md="4">
          <v-select
            v-model="task.data.end"
            :items="endActionOptions"
            item-title="title"
            item-value="value"
            label="End action"
            prepend-inner-icon="mdi-flag-checkered"
            variant="outlined"
            hide-details="auto"
          />
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
export default {
  name: 'MacroTimerTaskAccordion',

  data() {
    return {
      endActionOptions: [
        { title: 'Blink', value: 'blink' },
        { title: 'Fade', value: 'fade' },
      ],
    }
  },

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },

  emits: ['remove', 'move-up', 'move-down'],

  computed: {
    task(): any {
      const task = (this.item as any).task

      task.channel = 'timer'
      task.method = 'start'
      task.data = task.data && typeof task.data === 'object' ? task.data : {}

      if (!Number.isFinite(Number(task.data.time))) {
        task.data.time = 600
      }

      task.data.end ??= ''

      return task
    },
  },

  created() {
    this.task
  },
}
</script>
